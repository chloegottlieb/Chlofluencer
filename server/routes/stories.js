import { Router } from 'express';
import { HttpError } from '../auth.js';
import { STORY_TTL_MS } from '../lib/feed.js';
import { LIMITS, isSafeBackground, normalizeTags } from '../lib/validation.js';
import { canViewStory, getSettings, isFollowing, newId, notify, publicUser, storyStats } from '../lib/social.js';
import { serializeStory } from '../lib/serialize.js';
import { mediaKind, removeUpload } from '../uploads.js';
import { conversationId, isMutual } from '../lib/messaging.js';
import { CONTENT_REJECTED, findBlockedTerm } from '../lib/contentFilter.js';

const DEFAULT_BACKGROUND = 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)';
const bool = (v, fallback) => (v === undefined || v === '' ? fallback : v === true || v === 'true');

export default function storyRoutes({ db, auth, now, upload, uploadDir }) {
  const router = Router();
  router.use(auth);

  const getStory = (id) => {
    const story = db.find('stories', (s) => s.id === id);
    if (!story) throw new HttpError(404, 'Story not found');
    return story;
  };

  router.post('/', upload.single('media'), (req, res) => {
    const body = req.body ?? {};
    const settings = getSettings(db, req.user.id);
    const text = String(body.text ?? '').trim();
    const caption = String(body.caption ?? '').trim();
    const cleanup = () => req.file && removeUpload(uploadDir, `/uploads/${req.file.filename}`);

    let type = 'text';
    if (req.file) type = mediaKind(req.file.mimetype);
    if (type === 'text' && !text) {
      throw new HttpError(400, 'Add a photo, video or some text to share a story');
    }
    const blockedField = [['text', text], ['caption', caption], ['tags', String(body.tags ?? '')]].find(([, v]) => findBlockedTerm(v));
    if (blockedField) {
      cleanup();
      throw new HttpError(400, CONTENT_REJECTED, { field: blockedField[0] });
    }
    if (text.length > LIMITS.storyTextMax) {
      cleanup();
      throw new HttpError(400, `Story text must be ${LIMITS.storyTextMax} characters or fewer`, { field: 'text' });
    }
    if (caption.length > LIMITS.captionMax) {
      cleanup();
      throw new HttpError(400, `Caption must be ${LIMITS.captionMax} characters or fewer`, { field: 'caption' });
    }
    const audience = body.audience ?? settings.stories.defaultAudience;
    if (!['public', 'followers'].includes(audience)) {
      cleanup();
      throw new HttpError(400, 'Audience must be "public" or "followers"', { field: 'audience' });
    }
    let durationMs = null;
    if (type === 'video') {
      const d = Number(body.durationMs);
      durationMs = Number.isFinite(d) && d > 0 ? Math.min(d, 60_000) : 15_000;
    }
    const createdAt = now();
    const story = db.insert('stories', {
      id: newId(),
      authorId: req.user.id,
      type,
      mediaUrl: req.file ? `/uploads/${req.file.filename}` : null,
      text,
      background: isSafeBackground(body.background) ? body.background : DEFAULT_BACKGROUND,
      caption,
      tags: normalizeTags(body.tags),
      audience,
      allowDiscovery: audience === 'public' && bool(body.allowDiscovery, true),
      sensitive: bool(body.sensitive, false),
      durationMs,
      createdAt,
      expiresAt: createdAt + STORY_TTL_MS,
    });
    res.status(201).json({ story: serializeStory(db, story, req.user.id, { now: createdAt }) });
  });

  router.get('/mine', (req, res) => {
    const t = now();
    const stats = storyStats(db);
    const stories = db
      .filter('stories', (s) => s.authorId === req.user.id && s.expiresAt > t)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => serializeStory(db, s, req.user.id, { stats, now: t }));
    res.json({ stories });
  });

  router.get('/archive', (req, res) => {
    const t = now();
    const stats = storyStats(db);
    const stories = db
      .filter('stories', (s) => s.authorId === req.user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => serializeStory(db, s, req.user.id, { stats, now: t }));
    res.json({ stories });
  });

  router.get('/replies', (req, res) => {
    const replies = db
      .filter('replies', (r) => r.toId === req.user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        id: r.id,
        text: r.text,
        createdAt: r.createdAt,
        from: publicUser(db.find('users', (u) => u.id === r.fromId)),
        storyId: r.storyId,
        canMessage: isMutual(db, req.user.id, r.fromId),
      }))
      .filter((r) => r.from);
    res.json({ replies });
  });

  router.get('/:id', (req, res) => {
    const story = getStory(req.params.id);
    const t = now();
    const inHighlight = db.all('highlights').some((h) => h.storyIds.includes(story.id));
    if (!canViewStory(db, req.user.id, story, { now: t, ignoreExpiry: inHighlight })) {
      throw new HttpError(404, 'Story not found');
    }
    res.json({ story: serializeStory(db, story, req.user.id, { now: t }) });
  });

  router.delete('/:id', (req, res) => {
    const story = getStory(req.params.id);
    if (story.authorId !== req.user.id) throw new HttpError(403, 'You can only delete your own stories');
    removeUpload(uploadDir, story.mediaUrl);
    db.remove('stories', (s) => s.id === story.id);
    db.remove('views', (v) => v.storyId === story.id);
    db.remove('likes', (l) => l.storyId === story.id);
    for (const h of db.filter('highlights', (h) => h.storyIds.includes(story.id))) {
      const storyIds = h.storyIds.filter((id) => id !== story.id);
      if (!storyIds.length) db.remove('highlights', (x) => x.id === h.id);
      else db.update('highlights', (x) => x.id === h.id, { storyIds, coverStoryId: h.coverStoryId === story.id ? storyIds[0] : h.coverStoryId });
    }
    res.json({ ok: true });
  });

  const viewable = (req) => {
    const story = getStory(req.params.id);
    const inHighlight = db.all('highlights').some((h) => h.storyIds.includes(story.id));
    if (!canViewStory(db, req.user.id, story, { now: now(), ignoreExpiry: inHighlight })) throw new HttpError(404, 'Story not found');
    return story;
  };

  router.post('/:id/view', (req, res) => {
    const story = viewable(req);
    if (story.authorId === req.user.id) return res.json({ ok: true });
    let completion = Number(req.body?.completion ?? 1);
    if (!Number.isFinite(completion)) completion = 1;
    completion = Math.max(0, Math.min(1, completion));
    const source = req.body?.source === 'discover' ? 'discover' : req.body?.source === 'highlight' ? 'highlight' : 'friends';
    const existing = db.find('views', (v) => v.storyId === story.id && v.viewerId === req.user.id);
    if (existing) {
      db.update('views', (v) => v === existing, { completion: Math.max(existing.completion, completion) });
    } else {
      db.insert('views', { storyId: story.id, viewerId: req.user.id, completion, source, viewedAt: now() });
    }
    res.json({ ok: true });
  });

  router.post('/:id/like', (req, res) => {
    const story = viewable(req);
    if (!getSettings(db, story.authorId).stories.allowLikes) throw new HttpError(403, 'Likes are turned off for this story');
    if (!db.find('likes', (l) => l.storyId === story.id && l.userId === req.user.id)) {
      db.insert('likes', { storyId: story.id, userId: req.user.id, createdAt: now() });
      notify(db, { userId: story.authorId, type: 'like', actorId: req.user.id, storyId: story.id, now: now() });
    }
    res.json({ liked: true });
  });

  router.delete('/:id/like', (req, res) => {
    const story = getStory(req.params.id);
    db.remove('likes', (l) => l.storyId === story.id && l.userId === req.user.id);
    res.json({ liked: false });
  });

  router.post('/:id/reply', (req, res) => {
    const story = viewable(req);
    if (story.authorId === req.user.id) throw new HttpError(400, "You can't reply to your own story");
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'Reply cannot be empty', { field: 'text' });
    if (text.length > LIMITS.replyMax) throw new HttpError(400, `Reply must be ${LIMITS.replyMax} characters or fewer`, { field: 'text' });
    if (findBlockedTerm(text)) throw new HttpError(400, CONTENT_REJECTED, { field: 'text' });
    const pref = getSettings(db, story.authorId).privacy.storyReplies;
    if (pref === 'off') throw new HttpError(403, 'Replies are turned off for this story');
    if (pref === 'following' && !isFollowing(db, story.authorId, req.user.id)) {
      throw new HttpError(403, 'Only people this creator follows can reply');
    }
    if (isMutual(db, req.user.id, story.authorId)) {
      const message = db.insert('messages', {
        id: newId(),
        conversationId: conversationId(req.user.id, story.authorId),
        fromId: req.user.id,
        toId: story.authorId,
        text,
        storyId: story.id,
        createdAt: now(),
        readAt: null,
      });
      return res.status(201).json({ delivered: 'dm', message });
    }
    const reply = db.insert('replies', { id: newId(), storyId: story.id, fromId: req.user.id, toId: story.authorId, text, createdAt: now() });
    notify(db, { userId: story.authorId, type: 'reply', actorId: req.user.id, storyId: story.id, text, now: now() });
    res.status(201).json({ delivered: 'reply', reply });
  });

  router.get('/:id/viewers', (req, res) => {
    const story = getStory(req.params.id);
    if (story.authorId !== req.user.id) throw new HttpError(403, 'Only the author can see viewers');
    const viewers = db
      .filter('views', (v) => v.storyId === story.id)
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .map((v) => ({
        user: publicUser(db.find('users', (u) => u.id === v.viewerId)),
        viewedAt: v.viewedAt,
        source: v.source,
        liked: !!db.find('likes', (l) => l.storyId === story.id && l.userId === v.viewerId),
      }))
      .filter((v) => v.user);
    const discoverViews = viewers.filter((v) => v.source === 'discover').length;
    res.json({ viewers, total: viewers.length, discoverViews, likes: viewers.filter((v) => v.liked).length });
  });

  return router;
}
