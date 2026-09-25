import { Router } from 'express';
import { HttpError, verifyPassword } from '../auth.js';
import {
  assertValid,
  normalizeTags,
  validateBio,
  validateWebsite,
  LIMITS,
} from '../lib/validation.js';
import {
  canViewContent,
  canViewStory,
  followRecord,
  getSettings,
  isBlockedEitherWay,
  newId,
  notify,
  publicUser,
  storyStats,
} from '../lib/social.js';
import { serializeStory } from '../lib/serialize.js';
import { selfUser } from './auth.js';
import { assertClean } from '../lib/contentFilter.js';
import { messagingStatus } from '../lib/messaging.js';
import { removeUpload, mediaKind } from '../uploads.js';

export default function userRoutes({ db, auth, now, upload, uploadDir, moderators }) {
  const router = Router();
  router.use(auth);

  // Suspended accounts disappear from the app (moderators can still see them).
  const byUsername = (username, req) => {
    const user = db.find('users', (u) => u.username === String(username).toLowerCase());
    if (!user || (user.suspended && !req?.isModerator)) throw new HttpError(404, 'User not found');
    return user;
  };
  const visible = (u) => u && !u.suspended;

  const counts = (userId) => ({
    followers: db.filter('follows', (f) => f.followeeId === userId && f.status === 'accepted').length,
    following: db.filter('follows', (f) => f.followerId === userId && f.status === 'accepted').length,
    highlights: db.filter('highlights', (h) => h.ownerId === userId).length,
  });

  // --- Current user -------------------------------------------------------
  router.patch('/me', (req, res) => {
    const { displayName, bio, website, interests } = req.body ?? {};
    const patch = {};
    if (displayName !== undefined) {
      const name = String(displayName).trim();
      if (!name) throw new HttpError(400, 'Name cannot be empty', { field: 'displayName' });
      if (name.length > LIMITS.displayNameMax) throw new HttpError(400, `Name must be ${LIMITS.displayNameMax} characters or fewer`, { field: 'displayName' });
      patch.displayName = name;
    }
    assertClean({ displayName, bio, website });
    if (bio !== undefined) {
      assertValid(validateBio(bio), 'bio');
      patch.bio = String(bio);
    }
    if (website !== undefined) {
      assertValid(validateWebsite(website), 'website');
      patch.website = String(website);
    }
    if (interests !== undefined) patch.interests = normalizeTags(interests, LIMITS.maxInterests);
    const user = db.update('users', (u) => u.id === req.user.id, patch);
    res.json({ user: selfUser(db, user, moderators) });
  });

  router.post('/me/avatar', upload.single('avatar'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image to upload');
    if (mediaKind(req.file.mimetype) !== 'image') {
      removeUpload(uploadDir, `/uploads/${req.file.filename}`);
      throw new HttpError(400, 'Profile pictures must be images');
    }
    removeUpload(uploadDir, req.user.avatarUrl);
    const user = db.update('users', (u) => u.id === req.user.id, { avatarUrl: `/uploads/${req.file.filename}` });
    res.json({ user: selfUser(db, user, moderators) });
  });

  router.delete('/me/avatar', (req, res) => {
    removeUpload(uploadDir, req.user.avatarUrl);
    const user = db.update('users', (u) => u.id === req.user.id, { avatarUrl: null });
    res.json({ user: selfUser(db, user, moderators) });
  });

  router.delete('/me', (req, res) => {
    if (!verifyPassword(req.body?.password, req.user.passwordHash)) {
      throw new HttpError(403, 'Password is incorrect', { field: 'password' });
    }
    const id = req.user.id;
    for (const s of db.filter('stories', (s) => s.authorId === id)) removeUpload(uploadDir, s.mediaUrl);
    removeUpload(uploadDir, req.user.avatarUrl);
    const storyIds = new Set(db.filter('stories', (s) => s.authorId === id).map((s) => s.id));
    db.remove('stories', (s) => s.authorId === id);
    db.remove('views', (v) => v.viewerId === id || storyIds.has(v.storyId));
    db.remove('likes', (l) => l.userId === id || storyIds.has(l.storyId));
    db.remove('replies', (r) => r.fromId === id || r.toId === id);
    db.remove('messages', (m) => m.fromId === id || m.toId === id);
    db.remove('highlights', (h) => h.ownerId === id);
    db.remove('follows', (f) => f.followerId === id || f.followeeId === id);
    db.remove('blocks', (b) => b.blockerId === id || b.blockedId === id);
    db.remove('mutes', (m) => m.muterId === id || m.mutedId === id);
    db.remove('notInterested', (n) => n.userId === id || n.authorId === id);
    db.remove('notifications', (n) => n.userId === id || n.actorId === id);
    db.remove('settings', (s) => s.userId === id);
    db.remove('users', (u) => u.id === id);
    res.json({ ok: true });
  });

  router.get('/me/requests', (req, res) => {
    const requests = db
      .filter('follows', (f) => f.followeeId === req.user.id && f.status === 'pending')
      .map((f) => ({ user: publicUser(db.find('users', (u) => u.id === f.followerId)), createdAt: f.createdAt }));
    res.json({ requests });
  });

  router.post('/me/requests/:userId/:action', (req, res) => {
    const { userId, action } = req.params;
    const rec = followRecord(db, userId, req.user.id);
    if (!rec || rec.status !== 'pending') throw new HttpError(404, 'Follow request not found');
    if (action === 'accept') {
      db.update('follows', (f) => f === rec, { status: 'accepted' });
      notify(db, { userId, type: 'follow_accepted', actorId: req.user.id, now: now() });
    } else if (action === 'decline') {
      db.remove('follows', (f) => f === rec);
    } else {
      throw new HttpError(400, 'Unknown action');
    }
    res.json({ ok: true });
  });

  const listRelation = (collection, ownerKey, otherKey) => (req, res) => {
    const users = db
      .filter(collection, (r) => r[ownerKey] === req.user.id)
      .map((r) => publicUser(db.find('users', (u) => u.id === r[otherKey])))
      .filter(Boolean);
    res.json({ users });
  };
  router.get('/me/blocked', listRelation('blocks', 'blockerId', 'blockedId'));
  router.get('/me/muted', listRelation('mutes', 'muterId', 'mutedId'));
  router.get('/me/not-interested', listRelation('notInterested', 'userId', 'authorId'));

  // --- Search ---------------------------------------------------------------
  router.get('/search', (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return res.json({ users: [] });
    const users = db
      .filter(
        'users',
        (u) =>
          visible(u) &&
          !isBlockedEitherWay(db, req.user.id, u.id) &&
          (u.username.includes(q) || u.displayName.toLowerCase().includes(q)),
      )
      .sort((a, b) => Number(b.username.startsWith(q)) - Number(a.username.startsWith(q)) || a.username.localeCompare(b.username))
      .slice(0, 20)
      .map(publicUser);
    res.json({ users });
  });

  // --- Other profiles -----------------------------------------------------
  router.get('/:username', (req, res) => {
    const user = byUsername(req.params.username, req);
    const me = req.user.id;
    if (user.id !== me && db.find('blocks', (b) => b.blockerId === user.id && b.blockedId === me)) {
      throw new HttpError(404, 'User not found');
    }
    const t = now();
    const settings = getSettings(db, user.id);
    const rec = followRecord(db, me, user.id);
    const canView = canViewContent(db, me, user);
    const activeStories = canView
      ? db.filter('stories', (s) => s.authorId === user.id && s.expiresAt > t && (user.id === me || (!s.moderation && (s.audience === 'public' || rec?.status === 'accepted'))))
      : [];
    res.json({
      user: publicUser(user),
      counts: counts(user.id),
      isMe: user.id === me,
      isPrivate: settings.privacy.privateAccount,
      canView,
      relationship: {
        following: rec?.status ?? 'none',
        followsYou: followRecord(db, user.id, me)?.status === 'accepted',
        blocked: !!db.find('blocks', (b) => b.blockerId === me && b.blockedId === user.id),
        muted: !!db.find('mutes', (m) => m.muterId === me && m.mutedId === user.id),
        notInterested: !!db.find('notInterested', (n) => n.userId === me && n.authorId === user.id),
      },
      // Activity status is reciprocal: you only see others' if you share yours.
      lastActiveAt:
        user.id !== me && settings.privacy.showActivityStatus && getSettings(db, me).privacy.showActivityStatus && canView
          ? user.lastActiveAt ?? null
          : null,
      messaging: messagingStatus(db, me, user.id),
      hasActiveStory: activeStories.length > 0,
      hasUnseenStory: activeStories.some((s) => !db.find('views', (v) => v.storyId === s.id && v.viewerId === me)),
    });
  });

  router.get('/:username/stories', (req, res) => {
    const user = byUsername(req.params.username, req);
    const t = now();
    const stats = storyStats(db);
    const stories = db
      .filter('stories', (s) => s.authorId === user.id && canViewStory(db, req.user.id, s, { now: t }))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => serializeStory(db, s, req.user.id, { stats, now: t }));
    res.json({ author: publicUser(user), stories });
  });

  router.get('/:username/followers', (req, res) => {
    const user = byUsername(req.params.username, req);
    if (!canViewContent(db, req.user.id, user)) throw new HttpError(403, 'This account is private');
    const users = db
      .filter('follows', (f) => f.followeeId === user.id && f.status === 'accepted')
      .map((f) => db.find('users', (u) => u.id === f.followerId))
      .filter(visible)
      .map(publicUser);
    res.json({ users });
  });

  router.get('/:username/following', (req, res) => {
    const user = byUsername(req.params.username, req);
    if (!canViewContent(db, req.user.id, user)) throw new HttpError(403, 'This account is private');
    const users = db
      .filter('follows', (f) => f.followerId === user.id && f.status === 'accepted')
      .map((f) => db.find('users', (u) => u.id === f.followeeId))
      .filter(visible)
      .map(publicUser);
    res.json({ users });
  });

  router.post('/:username/follow', (req, res) => {
    const user = byUsername(req.params.username, req);
    const me = req.user.id;
    if (user.id === me) throw new HttpError(400, "You can't follow yourself");
    if (isBlockedEitherWay(db, me, user.id)) throw new HttpError(403, "You can't follow this account");
    let rec = followRecord(db, me, user.id);
    if (!rec) {
      const isPrivate = getSettings(db, user.id).privacy.privateAccount;
      rec = db.insert('follows', { followerId: me, followeeId: user.id, status: isPrivate ? 'pending' : 'accepted', createdAt: now() });
      db.remove('notInterested', (n) => n.userId === me && n.authorId === user.id);
      notify(db, { userId: user.id, type: isPrivate ? 'follow_request' : 'follow', actorId: me, now: now() });
    }
    res.json({ following: rec.status });
  });

  router.delete('/:username/follow', (req, res) => {
    const user = byUsername(req.params.username, req);
    db.remove('follows', (f) => f.followerId === req.user.id && f.followeeId === user.id);
    res.json({ following: 'none' });
  });

  router.delete('/:username/follower', (req, res) => {
    const user = byUsername(req.params.username, req);
    db.remove('follows', (f) => f.followerId === user.id && f.followeeId === req.user.id);
    res.json({ ok: true });
  });

  const toggle = (collection, makeDoc, matches, onAdd) => {
    router.post(`/:username/${collection.path}`, (req, res) => {
      const user = byUsername(req.params.username, req);
      if (user.id === req.user.id) throw new HttpError(400, `You can't ${collection.verb} yourself`);
      if (!db.find(collection.name, (d) => matches(d, req.user.id, user.id))) {
        db.insert(collection.name, makeDoc(req.user.id, user.id));
        onAdd?.(req.user.id, user.id);
      }
      res.json({ [collection.flag]: true });
    });
    router.delete(`/:username/${collection.path}`, (req, res) => {
      const user = byUsername(req.params.username, req);
      db.remove(collection.name, (d) => matches(d, req.user.id, user.id));
      res.json({ [collection.flag]: false });
    });
  };

  toggle(
    { name: 'blocks', path: 'block', verb: 'block', flag: 'blocked' },
    (a, b) => ({ blockerId: a, blockedId: b, createdAt: now() }),
    (d, a, b) => d.blockerId === a && d.blockedId === b,
    (a, b) => db.remove('follows', (f) => (f.followerId === a && f.followeeId === b) || (f.followerId === b && f.followeeId === a)),
  );
  toggle(
    { name: 'mutes', path: 'mute', verb: 'mute', flag: 'muted' },
    (a, b) => ({ muterId: a, mutedId: b, createdAt: now() }),
    (d, a, b) => d.muterId === a && d.mutedId === b,
  );
  toggle(
    { name: 'notInterested', path: 'not-interested', verb: 'hide', flag: 'notInterested' },
    (a, b) => ({ userId: a, authorId: b, createdAt: now() }),
    (d, a, b) => d.userId === a && d.authorId === b,
  );

  return router;
}
