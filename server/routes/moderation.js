import { Router } from 'express';
import { HttpError } from '../auth.js';
import {
  AUTO_HIDE_THRESHOLD,
  MODERATION_ACTIONS,
  REPORT_REASONS,
  REPORT_TARGETS,
  isModerator,
} from '../lib/moderation.js';
import { newId, publicUser } from '../lib/social.js';

const DETAILS_MAX = 500;

/** Reporting (any user) and the moderator review queue. */
export default function moderationRoutes({ db, auth, now, moderators }) {
  const reports = Router();
  const mod = Router();
  reports.use(auth);
  mod.use(auth, (req, _res, next) => (req.isModerator ? next() : next(new HttpError(403, 'Moderators only'))));

  const findUser = (id) => db.find('users', (u) => u.id === id);

  /** Work out who owns the reported thing, and keep a copy as evidence. */
  function resolveTarget(type, id, reporterId) {
    if (type === 'story') {
      const s = db.find('stories', (x) => x.id === id);
      if (!s) return null;
      return {
        ownerId: s.authorId,
        snapshot: { type: s.type, text: s.text, caption: s.caption, mediaUrl: s.mediaUrl, background: s.background, tags: s.tags },
      };
    }
    if (type === 'user') {
      const u = findUser(id);
      if (!u) return null;
      return { ownerId: u.id, snapshot: { username: u.username, displayName: u.displayName, bio: u.bio, avatarUrl: u.avatarUrl } };
    }
    if (type === 'message') {
      const m = db.find('messages', (x) => x.id === id);
      // You can only report messages that were sent to you.
      if (!m || m.toId !== reporterId) return null;
      return { ownerId: m.fromId, snapshot: { text: m.text } };
    }
    if (type === 'reply') {
      const r = db.find('replies', (x) => x.id === id);
      if (!r || r.toId !== reporterId) return null;
      return { ownerId: r.fromId, snapshot: { text: r.text } };
    }
    return null;
  }

  const notifySystem = (userId, type, text, storyId = null) =>
    db.insert('notifications', { id: newId(), userId, type, actorId: null, storyId, text, createdAt: now(), read: false });

  // --- Reporting -------------------------------------------------------------------
  reports.get('/reasons', (_req, res) => res.json({ reasons: REPORT_REASONS }));

  reports.post('/', (req, res) => {
    const { targetType, targetId, reason, details = '', block = false } = req.body ?? {};
    if (!REPORT_TARGETS.includes(targetType)) throw new HttpError(400, 'Unknown report type', { field: 'targetType' });
    if (!REPORT_REASONS[reason]) throw new HttpError(400, 'Choose a reason for your report', { field: 'reason' });
    const note = String(details).trim();
    if (note.length > DETAILS_MAX) throw new HttpError(400, `Details must be ${DETAILS_MAX} characters or fewer`, { field: 'details' });
    const target = resolveTarget(targetType, String(targetId ?? ''), req.user.id);
    if (!target) throw new HttpError(404, "We couldn't find that content");
    if (target.ownerId === req.user.id) throw new HttpError(400, "You can't report your own content");

    let report = db.find(
      'reports',
      (r) => r.reporterId === req.user.id && r.targetType === targetType && r.targetId === targetId && r.status === 'open',
    );
    const duplicate = !!report;
    if (!report) {
      report = db.insert('reports', {
        id: newId(),
        reporterId: req.user.id,
        targetType,
        targetId,
        targetUserId: target.ownerId,
        reason,
        details: note,
        snapshot: target.snapshot,
        status: 'open',
        createdAt: now(),
        resolvedAt: null,
        resolvedBy: null,
        action: null,
      });
    }

    // Enough independent reports hide a story until a moderator looks at it.
    let autoHidden = false;
    if (targetType === 'story') {
      const reporters = new Set(
        db.filter('reports', (r) => r.targetType === 'story' && r.targetId === targetId && r.status === 'open').map((r) => r.reporterId),
      );
      const story = db.find('stories', (s) => s.id === targetId);
      if (reporters.size >= AUTO_HIDE_THRESHOLD && story && !story.moderation) {
        db.update('stories', (s) => s.id === targetId, { moderation: { status: 'hidden', reason: 'reports', at: now() } });
        autoHidden = true;
      }
    }

    let blocked = false;
    if (block === true && !db.find('blocks', (b) => b.blockerId === req.user.id && b.blockedId === target.ownerId)) {
      db.insert('blocks', { blockerId: req.user.id, blockedId: target.ownerId, createdAt: now() });
      db.remove(
        'follows',
        (f) =>
          (f.followerId === req.user.id && f.followeeId === target.ownerId) ||
          (f.followerId === target.ownerId && f.followeeId === req.user.id),
      );
      blocked = true;
    }

    res.status(duplicate ? 200 : 201).json({ report: { id: report.id, status: report.status }, duplicate, blocked, autoHidden });
  });

  reports.get('/mine', (req, res) => {
    const mine = db
      .filter('reports', (r) => r.reporterId === req.user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ id: r.id, targetType: r.targetType, reason: r.reason, status: r.status, action: r.action, createdAt: r.createdAt }));
    res.json({ reports: mine });
  });

  // --- Moderator queue -----------------------------------------------------------------
  const currentContent = (type, id) => {
    if (type === 'story') {
      const s = db.find('stories', (x) => x.id === id);
      if (!s) return { state: 'deleted' };
      return {
        state: s.moderation?.status ?? 'visible',
        hiddenReason: s.moderation?.reason ?? null,
        story: { id: s.id, type: s.type, text: s.text, caption: s.caption, mediaUrl: s.mediaUrl, background: s.background, tags: s.tags, createdAt: s.createdAt },
      };
    }
    if (type === 'message') return { state: db.find('messages', (x) => x.id === id) ? 'visible' : 'deleted' };
    if (type === 'reply') return { state: db.find('replies', (x) => x.id === id) ? 'visible' : 'deleted' };
    return { state: 'visible' };
  };

  mod.get('/queue', (req, res) => {
    const status = req.query.status === 'resolved' ? 'resolved' : 'open';
    const matches = (r) => (status === 'open' ? r.status === 'open' : r.status !== 'open');
    const groups = new Map();
    for (const r of db.filter('reports', matches)) {
      const key = `${r.targetType}:${r.targetId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const items = [...groups.entries()].map(([key, list]) => {
      list.sort((a, b) => a.createdAt - b.createdAt);
      const { targetType, targetId, targetUserId } = list[0];
      const owner = findUser(targetUserId);
      const reasons = {};
      for (const r of list) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
      return {
        key,
        targetType,
        targetId,
        targetUser: owner ? { ...publicUser(owner), suspended: !!owner.suspended } : null,
        reportCount: list.length,
        reasons,
        firstReportedAt: list[0].createdAt,
        snapshot: list[list.length - 1].snapshot,
        content: currentContent(targetType, targetId),
        reports: list.map((r) => ({
          id: r.id,
          reporter: publicUser(findUser(r.reporterId)),
          reason: r.reason,
          details: r.details,
          createdAt: r.createdAt,
          status: r.status,
          action: r.action,
        })),
      };
    });
    // Most-reported first, then oldest first (so nothing waits too long).
    items.sort((a, b) => b.reportCount - a.reportCount || a.firstReportedAt - b.firstReportedAt);
    res.json({ items, openCount: db.filter('reports', (r) => r.status === 'open').length });
  });

  const suspend = (user, reason, moderatorId) => {
    if (isModerator(user, moderators)) throw new HttpError(400, "Moderators can't be suspended here");
    db.update('users', (u) => u.id === user.id, (u) => ({
      suspended: { at: now(), reason: String(reason || 'Community Guidelines violation').slice(0, 300), by: moderatorId },
      tokenVersion: (u.tokenVersion ?? 0) + 1, // signs them out everywhere
    }));
  };

  mod.post('/resolve', (req, res) => {
    const { targetType, targetId, action, note = '' } = req.body ?? {};
    if (!MODERATION_ACTIONS.includes(action)) throw new HttpError(400, 'Unknown action', { field: 'action' });
    const open = db.filter('reports', (r) => r.targetType === targetType && r.targetId === targetId && r.status === 'open');
    if (!open.length) throw new HttpError(404, 'No open reports for that content');
    const ownerId = open[0].targetUserId;
    const owner = findUser(ownerId);
    const removes = action === 'remove' || action === 'remove_and_suspend';
    const suspends = action === 'suspend' || action === 'remove_and_suspend';
    if (removes && targetType === 'user') throw new HttpError(400, 'To act on an account, suspend it');

    if (action === 'dismiss' && targetType === 'story') {
      // Restore a story that was only hidden because of reports.
      db.update('stories', (s) => s.id === targetId && s.moderation?.reason === 'reports', { moderation: null });
    }
    if (removes) {
      if (targetType === 'story') {
        db.update('stories', (s) => s.id === targetId, { moderation: { status: 'removed', reason: 'moderator', at: now(), by: req.user.id } });
        db.remove('highlights', (h) => h.storyIds.length === 1 && h.storyIds[0] === targetId);
        db.updateMany('highlights', (h) => h.storyIds.includes(targetId), (h) => ({ storyIds: h.storyIds.filter((id) => id !== targetId) }));
      } else if (targetType === 'message') {
        db.remove('messages', (m) => m.id === targetId);
      } else if (targetType === 'reply') {
        db.remove('replies', (r) => r.id === targetId);
      }
      if (owner) notifySystem(ownerId, 'content_removed', 'Your content was removed for violating our Community Guidelines.', targetType === 'story' ? targetId : null);
    }
    if (suspends && owner) suspend(owner, note, req.user.id);

    const t = now();
    const status = action === 'dismiss' ? 'dismissed' : 'actioned';
    db.updateMany('reports', (r) => open.includes(r), { status, action, resolvedAt: t, resolvedBy: req.user.id });
    db.insert('moderationActions', { id: newId(), moderatorId: req.user.id, targetType, targetId, targetUserId: ownerId, action, note: String(note).slice(0, 500), createdAt: t });

    const outcome =
      action === 'dismiss'
        ? "Thanks for your report. We reviewed it and it doesn't go against our Community Guidelines."
        : 'Thanks for your report. We took action because it went against our Community Guidelines.';
    for (const reporterId of new Set(open.map((r) => r.reporterId))) notifySystem(reporterId, 'report_resolved', outcome);

    res.json({ ok: true, resolved: open.length, status });
  });

  mod.post('/users/:username/suspend', (req, res) => {
    const user = db.find('users', (u) => u.username === req.params.username.toLowerCase());
    if (!user) throw new HttpError(404, 'User not found');
    if (user.id === req.user.id) throw new HttpError(400, "You can't suspend yourself");
    suspend(user, req.body?.reason, req.user.id);
    db.insert('moderationActions', { id: newId(), moderatorId: req.user.id, targetType: 'user', targetId: user.id, targetUserId: user.id, action: 'suspend', note: String(req.body?.reason ?? ''), createdAt: now() });
    res.json({ ok: true });
  });

  mod.post('/users/:username/unsuspend', (req, res) => {
    const user = db.find('users', (u) => u.username === req.params.username.toLowerCase());
    if (!user) throw new HttpError(404, 'User not found');
    db.update('users', (u) => u.id === user.id, { suspended: null });
    db.insert('moderationActions', { id: newId(), moderatorId: req.user.id, targetType: 'user', targetId: user.id, targetUserId: user.id, action: 'unsuspend', note: '', createdAt: now() });
    res.json({ ok: true });
  });

  mod.get('/suspended', (_req, res) => {
    const users = db
      .filter('users', (u) => u.suspended)
      .map((u) => ({ ...publicUser(u), suspended: u.suspended }));
    res.json({ users });
  });

  return { reports, mod };
}
