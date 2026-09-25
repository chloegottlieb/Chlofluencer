import { Router } from 'express';
import { HttpError } from '../auth.js';
import { LIMITS } from '../lib/validation.js';
import { canViewContent, isFollowing, newId, storyStats } from '../lib/social.js';
import { serializeStory } from '../lib/serialize.js';

export const MAX_STORIES_PER_HIGHLIGHT = 100;

export default function highlightRoutes({ db, auth, now }) {
  const router = Router();
  router.use(auth);

  const validTitle = (title) => {
    const t = String(title ?? '').trim();
    if (!t) throw new HttpError(400, 'Give your highlight a name', { field: 'title' });
    if (t.length > LIMITS.highlightTitleMax) throw new HttpError(400, `Highlight names must be ${LIMITS.highlightTitleMax} characters or fewer`, { field: 'title' });
    return t;
  };

  const ownStoryIds = (userId, ids) => {
    if (!Array.isArray(ids)) return [];
    const unique = [...new Set(ids.map(String))];
    for (const id of unique) {
      const story = db.find('stories', (s) => s.id === id);
      if (!story || story.authorId !== userId) throw new HttpError(400, 'You can only add your own stories to highlights');
    }
    return unique;
  };

  const shape = (h, viewerId, withStories = false) => {
    const cover = db.find('stories', (s) => s.id === h.coverStoryId) ?? db.find('stories', (s) => s.id === h.storyIds[0]);
    const out = {
      id: h.id,
      ownerId: h.ownerId,
      title: h.title,
      storyCount: h.storyIds.length,
      cover: cover ? { type: cover.type, mediaUrl: cover.mediaUrl, background: cover.background, text: cover.text } : null,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    };
    if (withStories) {
      const stats = storyStats(db);
      out.stories = h.storyIds
        .map((id) => db.find('stories', (s) => s.id === id))
        .filter(Boolean)
        .filter((s) => s.authorId === viewerId || s.audience === 'public' || isFollowing(db, viewerId, s.authorId))
        .map((s) => serializeStory(db, s, viewerId, { stats, now: now() }));
    }
    return out;
  };

  const owned = (req) => {
    const h = db.find('highlights', (x) => x.id === req.params.id);
    if (!h) throw new HttpError(404, 'Highlight not found');
    if (h.ownerId !== req.user.id) throw new HttpError(403, 'You can only edit your own highlights');
    return h;
  };

  router.get('/user/:username', (req, res) => {
    const user = db.find('users', (u) => u.username === req.params.username.toLowerCase());
    if (!user) throw new HttpError(404, 'User not found');
    if (!canViewContent(db, req.user.id, user)) return res.json({ highlights: [] });
    const highlights = db
      .filter('highlights', (h) => h.ownerId === user.id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((h) => shape(h, req.user.id));
    res.json({ highlights });
  });

  router.get('/:id', (req, res) => {
    const h = db.find('highlights', (x) => x.id === req.params.id);
    const owner = h && db.find('users', (u) => u.id === h.ownerId);
    if (!h || !canViewContent(db, req.user.id, owner)) throw new HttpError(404, 'Highlight not found');
    res.json({ highlight: shape(h, req.user.id, true) });
  });

  router.post('/', (req, res) => {
    const title = validTitle(req.body?.title);
    const storyIds = ownStoryIds(req.user.id, req.body?.storyIds);
    if (!storyIds.length) throw new HttpError(400, 'Pick at least one story', { field: 'storyIds' });
    if (storyIds.length > MAX_STORIES_PER_HIGHLIGHT) throw new HttpError(400, `Highlights hold up to ${MAX_STORIES_PER_HIGHLIGHT} stories`);
    const h = db.insert('highlights', {
      id: newId(),
      ownerId: req.user.id,
      title,
      storyIds,
      coverStoryId: storyIds[0],
      createdAt: now(),
      updatedAt: now(),
    });
    res.status(201).json({ highlight: shape(h, req.user.id, true) });
  });

  router.patch('/:id', (req, res) => {
    const h = owned(req);
    const { title, addStoryIds, removeStoryIds, coverStoryId } = req.body ?? {};
    const patch = { updatedAt: now() };
    if (title !== undefined) patch.title = validTitle(title);
    let storyIds = [...h.storyIds];
    for (const id of ownStoryIds(req.user.id, addStoryIds)) if (!storyIds.includes(id)) storyIds.push(id);
    if (Array.isArray(removeStoryIds)) storyIds = storyIds.filter((id) => !removeStoryIds.includes(id));
    if (storyIds.length > MAX_STORIES_PER_HIGHLIGHT) throw new HttpError(400, `Highlights hold up to ${MAX_STORIES_PER_HIGHLIGHT} stories`);
    if (!storyIds.length) {
      db.remove('highlights', (x) => x.id === h.id);
      return res.json({ highlight: null, deleted: true });
    }
    patch.storyIds = storyIds;
    if (coverStoryId !== undefined) {
      if (!storyIds.includes(coverStoryId)) throw new HttpError(400, 'Cover must be one of the highlight’s stories');
      patch.coverStoryId = coverStoryId;
    } else if (!storyIds.includes(h.coverStoryId)) {
      patch.coverStoryId = storyIds[0];
    }
    const updated = db.update('highlights', (x) => x.id === h.id, patch);
    res.json({ highlight: shape(updated, req.user.id, true) });
  });

  router.delete('/:id', (req, res) => {
    const h = owned(req);
    db.remove('highlights', (x) => x.id === h.id);
    res.json({ ok: true });
  });

  return router;
}
