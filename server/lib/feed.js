/**
 * The Storytime feed algorithm.
 *
 * The feed is one continuous tap-through queue in two phases:
 *   1. Friends  – active stories from accounts you follow (unseen first).
 *   2. Discover – a "For You" ranking of stories from creators you don't
 *                 follow yet, so finishing your friends rolls straight into
 *                 new creators.
 *
 * Everything in this module is pure: callers pass a snapshot of the data and
 * a clock, which makes the ranking fully unit-testable.
 */

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const NEW_CREATOR_WINDOW_MS = 14 * 24 * HOUR_MS;

export const WEIGHTS = {
  personalized: { interest: 0.35, engagement: 0.25, popularity: 0.1, freshness: 0.2, creator: 0.1 },
  generic: { interest: 0, engagement: 0.45, popularity: 0.25, freshness: 0.3, creator: 0 },
};

// Weights for how strongly each signal teaches the algorithm about a tag.
export const SIGNAL_WEIGHTS = {
  declaredInterest: 1,
  like: 2,
  reply: 2,
  completedView: 1,
  skippedView: -0.5,
};

export function isActive(story, now) {
  return story.expiresAt > now;
}

/** Deterministic PRNG (mulberry32) so exploration jitter is reproducible. */
export function seededRandom(seed) {
  let a = typeof seed === 'number' ? seed : hashString(String(seed));
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build a tag -> weight map describing what the viewer is into, from the
 * interests they declared plus how they have interacted with stories.
 */
export function buildTagAffinity({ interests = [], interactions = [] }) {
  const affinity = new Map();
  const add = (tag, w) => affinity.set(tag, (affinity.get(tag) ?? 0) + w);
  for (const tag of interests) add(tag, SIGNAL_WEIGHTS.declaredInterest);
  for (const { tags = [], liked, replied, completion } of interactions) {
    let w = 0;
    if (liked) w += SIGNAL_WEIGHTS.like;
    if (replied) w += SIGNAL_WEIGHTS.reply;
    if (typeof completion === 'number') {
      if (completion >= 0.9) w += SIGNAL_WEIGHTS.completedView;
      else if (completion < 0.3) w += SIGNAL_WEIGHTS.skippedView;
    }
    if (w) for (const tag of tags) add(tag, w);
  }
  return affinity;
}

/**
 * How the viewer feels about a specific creator in [-1, 1], based on how
 * much of that creator's stories they have watched and whether they liked any.
 */
export function creatorAffinity(interactionsWithCreator = []) {
  if (!interactionsWithCreator.length) return 0;
  const completions = interactionsWithCreator
    .map((i) => i.completion)
    .filter((c) => typeof c === 'number');
  const avg = completions.length ? completions.reduce((a, b) => a + b, 0) / completions.length : 0.5;
  const likeBoost = interactionsWithCreator.some((i) => i.liked) ? 0.3 : 0;
  return Math.max(-1, Math.min(1, avg * 2 - 1 + likeBoost));
}

export function interestScore(tags = [], affinity) {
  if (!tags.length || !affinity?.size) return { score: 0, topTag: null };
  let sum = 0;
  let topTag = null;
  let topWeight = 0;
  for (const tag of tags) {
    const w = affinity.get(tag) ?? 0;
    sum += w;
    if (w > topWeight) {
      topWeight = w;
      topTag = tag;
    }
  }
  if (sum <= 0) return { score: Math.max(-0.5, sum / 4), topTag: null };
  return { score: 1 - Math.exp(-sum / 2), topTag };
}

export function engagementScore(stats = {}) {
  const { views = 0, completions = 0, likes = 0, replies = 0 } = stats;
  // Bayesian-smoothed engagement rate so tiny samples don't dominate.
  const rate = (likes * 2 + replies * 3 + completions) / (views + 3);
  return Math.min(1, rate);
}

export function popularityScore(stats = {}) {
  return Math.min(1, Math.log10(1 + (stats.views ?? 0)) / 3);
}

export function freshnessScore(createdAt, now) {
  const ageHours = Math.max(0, now - createdAt) / HOUR_MS;
  return Math.exp(-ageHours / 10);
}

export function scoreStory(story, { now, stats, affinity, creator = 0, personalized = true, author }) {
  const w = personalized ? WEIGHTS.personalized : WEIGHTS.generic;
  const interest = personalized ? interestScore(story.tags, affinity) : { score: 0, topTag: null };
  const engagement = engagementScore(stats);
  const popularity = popularityScore(stats);
  const freshness = freshnessScore(story.createdAt, now);
  const score =
    w.interest * interest.score +
    w.engagement * engagement +
    w.popularity * popularity +
    w.freshness * freshness +
    w.creator * creator;

  const reasons = [];
  if (interest.topTag && interest.score >= 0.3) reasons.push(`Because you're into #${interest.topTag}`);
  if (engagement >= 0.5 || popularity >= 0.5) reasons.push('Trending');
  if (now - story.createdAt < 2 * HOUR_MS) reasons.push('Just posted');
  if (author && now - author.createdAt < NEW_CREATOR_WINDOW_MS) reasons.push('New creator');

  return { score, reasons, components: { interest: interest.score, engagement, popularity, freshness, creator } };
}

function canSeeAsFollower(story) {
  return story.audience === 'public' || story.audience === 'followers';
}

/**
 * Friends phase: one group per followed author with active stories.
 * Groups with unseen stories come first, then by most recent post.
 */
export function buildFriendGroups({ now, stories, followingIds, hiddenAuthorIds, seenStoryIds }) {
  const byAuthor = new Map();
  for (const story of stories) {
    if (!followingIds.has(story.authorId) || hiddenAuthorIds.has(story.authorId)) continue;
    if (!isActive(story, now) || !canSeeAsFollower(story) || story.moderation) continue;
    if (!byAuthor.has(story.authorId)) byAuthor.set(story.authorId, []);
    byAuthor.get(story.authorId).push(story);
  }
  const groups = [...byAuthor.entries()].map(([authorId, list]) => {
    list.sort((a, b) => a.createdAt - b.createdAt);
    const firstUnseen = list.findIndex((s) => !seenStoryIds.has(s.id));
    return {
      authorId,
      stories: list,
      hasUnseen: firstUnseen !== -1,
      startIndex: firstUnseen === -1 ? 0 : firstUnseen,
      latestAt: list[list.length - 1].createdAt,
    };
  });
  groups.sort((a, b) => Number(b.hasUnseen) - Number(a.hasUnseen) || b.latestAt - a.latestAt);
  return groups;
}

/** Is this story eligible to be recommended to a non-follower? */
export function isDiscoverable(story, { viewerId, now, author, followingIds, hiddenAuthorIds, seenStoryIds, hideSensitive }) {
  if (!author || author.suspended) return false;
  if (story.moderation) return false;
  if (story.authorId === viewerId) return false;
  if (followingIds.has(story.authorId) || hiddenAuthorIds.has(story.authorId)) return false;
  if (!isActive(story, now)) return false;
  if (story.audience !== 'public' || story.allowDiscovery === false) return false;
  if (author.settings?.privacy?.privateAccount) return false;
  if (author.settings?.discovery?.appearInDiscover === false) return false;
  if (hideSensitive && story.sensitive) return false;
  if (seenStoryIds.has(story.id)) return false;
  return true;
}

/**
 * Discover phase: rank unseen stories from creators the viewer doesn't follow,
 * grouped by creator (so tapping through feels like Instagram stories), then
 * diversified so the same topic doesn't appear back to back.
 */
export function buildDiscoverGroups({
  viewerId,
  now,
  stories,
  usersById,
  followingIds,
  hiddenAuthorIds,
  seenStoryIds,
  statsByStory,
  affinity,
  interactionsByCreator = new Map(),
  personalized = true,
  hideSensitive = true,
  seed = null,
  explorationJitter = 0.05,
}) {
  const rand = seed === null ? null : seededRandom(seed);
  const byAuthor = new Map();
  for (const story of stories) {
    const author = usersById.get(story.authorId);
    if (!isDiscoverable(story, { viewerId, now, author, followingIds, hiddenAuthorIds, seenStoryIds, hideSensitive })) continue;
    const creator = personalized ? creatorAffinity(interactionsByCreator.get(story.authorId)) : 0;
    const scored = scoreStory(story, { now, stats: statsByStory.get(story.id), affinity, creator, personalized, author });
    if (!byAuthor.has(story.authorId)) byAuthor.set(story.authorId, []);
    byAuthor.get(story.authorId).push({ story, ...scored });
  }

  const groups = [...byAuthor.entries()].map(([authorId, scoredStories]) => {
    scoredStories.sort((a, b) => a.story.createdAt - b.story.createdAt);
    const best = scoredStories.reduce((m, s) => (s.score > m.score ? s : m));
    const jitter = rand ? (rand() - 0.5) * 2 * explorationJitter : 0;
    const tagCounts = new Map();
    for (const { story } of scoredStories) for (const t of story.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    const primaryTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      authorId,
      stories: scoredStories.map((s) => s.story),
      score: best.score + 0.03 * Math.log1p(scoredStories.length - 1) + jitter,
      reasons: best.reasons,
      primaryTag,
      startIndex: 0,
      hasUnseen: true,
    };
  });

  return diversify(groups);
}

/** Greedy re-rank: penalise a group whose primary tag matches the previous pick. */
export function diversify(groups, penalty = 0.85) {
  const remaining = [...groups].sort((a, b) => b.score - a.score);
  const out = [];
  let lastTag = null;
  while (remaining.length) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    remaining.forEach((g, i) => {
      const effective = g.primaryTag && g.primaryTag === lastTag ? g.score * penalty : g.score;
      if (effective > bestScore) {
        bestScore = effective;
        bestIdx = i;
      }
    });
    const [picked] = remaining.splice(bestIdx, 1);
    out.push(picked);
    lastTag = picked.primaryTag;
  }
  return out;
}
