import { Router } from 'express';
import { buildDiscoverGroups, buildFriendGroups, buildTagAffinity } from '../lib/feed.js';
import { followingIds, getSettings, hiddenAuthorIds, publicUser, storyStats } from '../lib/social.js';
import { serializeStory } from '../lib/serialize.js';
import { purgeExpiredStories } from '../lib/maintenance.js';

const HOUR_MS = 60 * 60 * 1000;

/** Gather everything the pure feed algorithm needs about one viewer. */
export function feedContext(db, viewer, now) {
  const settings = getSettings(db, viewer.id);
  const storiesById = new Map(db.all('stories').map((s) => [s.id, s]));
  const interactions = new Map();
  const touch = (storyId) => {
    const story = storiesById.get(storyId);
    if (!story) return null;
    if (!interactions.has(storyId)) interactions.set(storyId, { storyId, authorId: story.authorId, tags: story.tags ?? [] });
    return interactions.get(storyId);
  };
  const seenStoryIds = new Set();
  for (const v of db.all('views')) {
    if (v.viewerId !== viewer.id) continue;
    seenStoryIds.add(v.storyId);
    const i = touch(v.storyId);
    if (i) i.completion = v.completion;
  }
  for (const l of db.all('likes')) if (l.userId === viewer.id) { const i = touch(l.storyId); if (i) i.liked = true; }
  for (const r of db.all('replies')) if (r.fromId === viewer.id) { const i = touch(r.storyId); if (i) i.replied = true; }
  for (const m of db.all('messages')) if (m.fromId === viewer.id && m.storyId) { const i = touch(m.storyId); if (i) i.replied = true; }

  const interactionsByCreator = new Map();
  for (const i of interactions.values()) {
    if (!interactionsByCreator.has(i.authorId)) interactionsByCreator.set(i.authorId, []);
    interactionsByCreator.get(i.authorId).push(i);
  }
  const usersById = new Map(db.all('users').map((u) => [u.id, { ...u, settings: getSettings(db, u.id) }]));

  return {
    viewerId: viewer.id,
    now,
    settings,
    stories: db.all('stories'),
    usersById,
    followingIds: followingIds(db, viewer.id),
    hiddenAuthorIds: hiddenAuthorIds(db, viewer.id),
    seenStoryIds,
    statsByStory: storyStats(db),
    affinity: buildTagAffinity({ interests: viewer.interests ?? [], interactions: [...interactions.values()] }),
    interactionsByCreator,
    personalized: settings.discovery.personalized,
    hideSensitive: settings.discovery.hideSensitive,
    seed: `${viewer.id}:${Math.floor(now / HOUR_MS)}`,
  };
}

export default function feedRoutes({ db, auth, now, uploadDir }) {
  const router = Router();
  router.use(auth);

  const serializeGroup = (group, viewerId, extra = {}) => ({
    author: publicUser(db.find('users', (u) => u.id === group.authorId)),
    stories: group.stories.map((s) => serializeStory(db, s, viewerId, { now: extra.now })),
    startIndex: group.startIndex,
    hasUnseen: group.hasUnseen,
    ...(group.reasons ? { reasons: group.reasons } : {}),
  });

  const discoverPage = (ctx, req) => {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? req.query.discoverLimit) || 10));
    const exclude = new Set(String(req.query.exclude ?? '').split(',').filter(Boolean));
    const groups = buildDiscoverGroups(ctx).filter((g) => !exclude.has(g.authorId));
    return {
      discover: groups.slice(0, limit).map((g) => serializeGroup(g, ctx.viewerId, { now: ctx.now })),
      discoverHasMore: groups.length > limit,
    };
  };

  router.get('/', (req, res) => {
    const t = now();
    purgeExpiredStories(db, t, uploadDir);
    const ctx = feedContext(db, req.user, t);
    const mine = db.filter('stories', (s) => s.authorId === req.user.id && s.expiresAt > t).sort((a, b) => a.createdAt - b.createdAt);
    const friends = buildFriendGroups(ctx).map((g) => serializeGroup(g, req.user.id, { now: t }));
    const discoverEnabled = ctx.settings.discovery.showDiscover;
    res.json({
      me: {
        author: publicUser(req.user),
        stories: mine.map((s) => serializeStory(db, s, req.user.id, { now: t })),
      },
      friends,
      discoverEnabled,
      ...(discoverEnabled ? discoverPage(ctx, req) : { discover: [], discoverHasMore: false }),
    });
  });

  router.get('/discover', (req, res) => {
    const ctx = feedContext(db, req.user, now());
    if (!ctx.settings.discovery.showDiscover) return res.json({ discover: [], discoverHasMore: false });
    res.json(discoverPage(ctx, req));
  });

  return router;
}
