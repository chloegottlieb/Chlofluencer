import { describe, expect, it } from 'vitest';
import {
  STORY_TTL_MS,
  buildDiscoverGroups,
  buildFriendGroups,
  buildTagAffinity,
  creatorAffinity,
  diversify,
  engagementScore,
  freshnessScore,
  hashString,
  interestScore,
  isActive,
  isDiscoverable,
  popularityScore,
  scoreStory,
  seededRandom,
} from '../../server/lib/feed.js';

const HOUR = 3600_000;
const NOW = 1_800_000_000_000;

const story = (id, authorId, overrides = {}) => ({
  id,
  authorId,
  type: 'text',
  tags: [],
  audience: 'public',
  allowDiscovery: true,
  sensitive: false,
  createdAt: NOW - HOUR,
  expiresAt: NOW - HOUR + STORY_TTL_MS,
  ...overrides,
});

const user = (id, settings = {}) => ({
  id,
  username: id,
  createdAt: NOW - 400 * 24 * HOUR,
  settings: {
    privacy: { privateAccount: false, ...settings.privacy },
    discovery: { appearInDiscover: true, ...settings.discovery },
  },
});

const baseDiscover = (overrides = {}) => ({
  viewerId: 'me',
  now: NOW,
  stories: [],
  usersById: new Map(),
  followingIds: new Set(),
  hiddenAuthorIds: new Set(),
  seenStoryIds: new Set(),
  statsByStory: new Map(),
  affinity: new Map(),
  ...overrides,
});

describe('isActive', () => {
  it('is true until 24h after posting', () => {
    const s = story('s', 'a', { createdAt: NOW, expiresAt: NOW + STORY_TTL_MS });
    expect(isActive(s, NOW + STORY_TTL_MS - 1)).toBe(true);
    expect(isActive(s, NOW + STORY_TTL_MS)).toBe(false);
  });
});

describe('seededRandom / hashString', () => {
  it('is deterministic for the same seed', () => {
    const a = seededRandom('viewer:1');
    const b = seededRandom('viewer:1');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('produces values in [0, 1)', () => {
    const r = seededRandom(42);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('hashes strings to unsigned ints', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    expect(hashString('x')).toBeGreaterThanOrEqual(0);
  });
});

describe('buildTagAffinity', () => {
  it('weights declared interests', () => {
    const a = buildTagAffinity({ interests: ['travel', 'food'] });
    expect(a.get('travel')).toBe(1);
    expect(a.get('food')).toBe(1);
  });
  it('learns from likes, replies and completed views', () => {
    const a = buildTagAffinity({
      interactions: [
        { tags: ['fitness'], liked: true },
        { tags: ['fitness'], replied: true },
        { tags: ['music'], completion: 1 },
      ],
    });
    expect(a.get('fitness')).toBe(4);
    expect(a.get('music')).toBe(1);
  });
  it('penalises tags of stories the viewer skipped quickly', () => {
    const a = buildTagAffinity({ interests: ['comedy'], interactions: [{ tags: ['comedy'], completion: 0.1 }] });
    expect(a.get('comedy')).toBe(0.5);
  });
  it('ignores neutral partial views', () => {
    const a = buildTagAffinity({ interactions: [{ tags: ['art'], completion: 0.5 }] });
    expect(a.has('art')).toBe(false);
  });
});

describe('creatorAffinity', () => {
  it('is 0 with no history', () => {
    expect(creatorAffinity([])).toBe(0);
    expect(creatorAffinity()).toBe(0);
  });
  it('is positive when the viewer watches a creator to the end', () => {
    expect(creatorAffinity([{ completion: 1 }, { completion: 0.9 }])).toBeGreaterThan(0.7);
  });
  it('is negative when the viewer skips a creator', () => {
    expect(creatorAffinity([{ completion: 0.1 }])).toBeLessThan(-0.5);
  });
  it('gets a boost for likes and stays within [-1, 1]', () => {
    expect(creatorAffinity([{ completion: 1, liked: true }])).toBe(1);
    expect(creatorAffinity([{ completion: 0.5, liked: true }])).toBeCloseTo(0.3);
  });
});

describe('component scores', () => {
  it('interestScore is 0 with no overlap and grows with matches', () => {
    const affinity = new Map([['travel', 2], ['food', 1]]);
    expect(interestScore(['tech'], affinity).score).toBe(0);
    const one = interestScore(['food'], affinity).score;
    const two = interestScore(['food', 'travel'], affinity);
    expect(two.score).toBeGreaterThan(one);
    expect(two.topTag).toBe('travel');
    expect(two.score).toBeLessThan(1);
  });
  it('interestScore can go negative for disliked topics', () => {
    const { score } = interestScore(['comedy'], new Map([['comedy', -1]]));
    expect(score).toBeLessThan(0);
    expect(score).toBeGreaterThanOrEqual(-0.5);
  });
  it('engagementScore is smoothed and capped at 1', () => {
    expect(engagementScore({})).toBe(0);
    expect(engagementScore({ views: 1, likes: 1 })).toBeCloseTo(0.5);
    expect(engagementScore({ views: 10, likes: 10, replies: 10, completions: 10 })).toBe(1);
  });
  it('popularityScore grows logarithmically and caps at 1', () => {
    expect(popularityScore({ views: 0 })).toBe(0);
    expect(popularityScore({ views: 9 })).toBeCloseTo(1 / 3);
    expect(popularityScore({ views: 1e6 })).toBe(1);
  });
  it('freshnessScore decays with age', () => {
    expect(freshnessScore(NOW, NOW)).toBe(1);
    expect(freshnessScore(NOW - 10 * HOUR, NOW)).toBeCloseTo(Math.exp(-1));
    expect(freshnessScore(NOW - 2 * HOUR, NOW)).toBeGreaterThan(freshnessScore(NOW - 20 * HOUR, NOW));
  });
});

describe('scoreStory', () => {
  it('adds human-readable reasons', () => {
    const s = story('s', 'a', { tags: ['travel'], createdAt: NOW - 10 * 60_000 });
    const { reasons } = scoreStory(s, {
      now: NOW,
      stats: { views: 100, likes: 80 },
      affinity: new Map([['travel', 3]]),
      author: { createdAt: NOW - HOUR },
    });
    expect(reasons).toEqual(["Because you're into #travel", 'Trending', 'Just posted', 'New creator']);
  });
  it('ignores interests when personalization is off', () => {
    const s = story('s', 'a', { tags: ['travel'] });
    const on = scoreStory(s, { now: NOW, affinity: new Map([['travel', 5]]), personalized: true });
    const off = scoreStory(s, { now: NOW, affinity: new Map([['travel', 5]]), personalized: false });
    expect(off.components.interest).toBe(0);
    expect(on.components.interest).toBeGreaterThan(0);
  });
});

describe('buildFriendGroups', () => {
  const stories = [
    story('a1', 'alice', { createdAt: NOW - 5 * HOUR }),
    story('a2', 'alice', { createdAt: NOW - 2 * HOUR }),
    story('b1', 'bob', { createdAt: NOW - 1 * HOUR }),
    story('c1', 'carol', { createdAt: NOW - 3 * HOUR }),
    story('x1', 'stranger'),
    story('old', 'alice', { createdAt: NOW - 30 * HOUR, expiresAt: NOW - 6 * HOUR }),
  ];
  const input = (over = {}) => ({
    now: NOW,
    stories,
    followingIds: new Set(['alice', 'bob', 'carol']),
    hiddenAuthorIds: new Set(),
    seenStoryIds: new Set(),
    ...over,
  });

  it('only includes active stories from followed accounts', () => {
    const groups = buildFriendGroups(input());
    expect(groups.map((g) => g.authorId).sort()).toEqual(['alice', 'bob', 'carol']);
    expect(groups.find((g) => g.authorId === 'alice').stories.map((s) => s.id)).toEqual(['a1', 'a2']);
  });

  it('orders unseen groups first, then by most recent post', () => {
    const groups = buildFriendGroups(input({ seenStoryIds: new Set(['b1']) }));
    expect(groups.map((g) => g.authorId)).toEqual(['alice', 'carol', 'bob']);
    expect(groups[2].hasUnseen).toBe(false);
  });

  it('starts a group at the first unseen story', () => {
    const groups = buildFriendGroups(input({ seenStoryIds: new Set(['a1']) }));
    expect(groups.find((g) => g.authorId === 'alice').startIndex).toBe(1);
  });

  it('excludes muted or blocked authors', () => {
    const groups = buildFriendGroups(input({ hiddenAuthorIds: new Set(['bob']) }));
    expect(groups.map((g) => g.authorId)).not.toContain('bob');
  });
});

describe('isDiscoverable', () => {
  const ctx = (over = {}) => ({
    viewerId: 'me',
    now: NOW,
    author: user('a'),
    followingIds: new Set(),
    hiddenAuthorIds: new Set(),
    seenStoryIds: new Set(),
    hideSensitive: true,
    ...over,
  });
  it('accepts a public active story from a stranger', () => {
    expect(isDiscoverable(story('s', 'a'), ctx())).toBe(true);
  });
  it.each([
    ['own story', story('s', 'me'), {}],
    ['followed author', story('s', 'a'), { followingIds: new Set(['a']) }],
    ['hidden author', story('s', 'a'), { hiddenAuthorIds: new Set(['a']) }],
    ['expired', story('s', 'a', { expiresAt: NOW - 1 }), {}],
    ['followers-only', story('s', 'a', { audience: 'followers' }), {}],
    ['opted out story', story('s', 'a', { allowDiscovery: false }), {}],
    ['private author', story('s', 'a'), { author: user('a', { privacy: { privateAccount: true } }) }],
    ['author opted out', story('s', 'a'), { author: user('a', { discovery: { appearInDiscover: false } }) }],
    ['sensitive filtered', story('s', 'a', { sensitive: true }), {}],
    ['already seen', story('s', 'a'), { seenStoryIds: new Set(['s']) }],
    ['missing author', story('s', 'a'), { author: null }],
  ])('rejects %s', (_label, s, over) => {
    expect(isDiscoverable(s, ctx(over))).toBe(false);
  });
  it('allows sensitive stories when the filter is off', () => {
    expect(isDiscoverable(story('s', 'a', { sensitive: true }), ctx({ hideSensitive: false }))).toBe(true);
  });
});

describe('buildDiscoverGroups', () => {
  const usersById = new Map(['traveler', 'chef', 'coder', 'friend'].map((id) => [id, user(id)]));

  it('ranks creators matching the viewer interests first', () => {
    const groups = buildDiscoverGroups(
      baseDiscover({
        usersById,
        stories: [story('t', 'traveler', { tags: ['travel'] }), story('c', 'coder', { tags: ['tech'] })],
        affinity: buildTagAffinity({ interests: ['travel'] }),
      }),
    );
    expect(groups.map((g) => g.authorId)).toEqual(['traveler', 'coder']);
    expect(groups[0].reasons[0]).toBe("Because you're into #travel");
  });

  it('boosts highly engaged stories', () => {
    const groups = buildDiscoverGroups(
      baseDiscover({
        usersById,
        stories: [story('quiet', 'chef'), story('hot', 'coder')],
        statsByStory: new Map([['hot', { views: 50, likes: 40, completions: 45 }]]),
      }),
    );
    expect(groups[0].authorId).toBe('coder');
  });

  it('prefers fresher stories when everything else is equal', () => {
    const groups = buildDiscoverGroups(
      baseDiscover({
        usersById,
        stories: [story('old', 'chef', { createdAt: NOW - 20 * HOUR }), story('new', 'coder', { createdAt: NOW - 1 })],
      }),
    );
    expect(groups[0].authorId).toBe('coder');
  });

  it('never recommends friends or the viewer', () => {
    const groups = buildDiscoverGroups(
      baseDiscover({
        usersById: new Map([...usersById, ['me', user('me')]]),
        stories: [story('f', 'friend'), story('m', 'me'), story('c', 'chef')],
        followingIds: new Set(['friend']),
      }),
    );
    expect(groups.map((g) => g.authorId)).toEqual(['chef']);
  });

  it('groups a creator’s stories chronologically', () => {
    const groups = buildDiscoverGroups(
      baseDiscover({
        usersById,
        stories: [story('c2', 'chef', { createdAt: NOW - HOUR }), story('c1', 'chef', { createdAt: NOW - 3 * HOUR })],
      }),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].stories.map((s) => s.id)).toEqual(['c1', 'c2']);
  });

  it('demotes creators the viewer keeps skipping', () => {
    const stories = [story('a', 'chef'), story('b', 'coder')];
    const neutral = buildDiscoverGroups(baseDiscover({ usersById, stories }));
    const skipped = buildDiscoverGroups(
      baseDiscover({
        usersById,
        stories,
        interactionsByCreator: new Map([[neutral[0].authorId, [{ completion: 0 }, { completion: 0.05 }]]]),
      }),
    );
    expect(skipped[0].authorId).not.toBe(neutral[0].authorId);
  });

  it('is deterministic for a given seed', () => {
    const opts = baseDiscover({ usersById, stories: [story('a', 'chef'), story('b', 'coder'), story('c', 'traveler')], seed: 'x' });
    expect(buildDiscoverGroups(opts).map((g) => g.authorId)).toEqual(buildDiscoverGroups(opts).map((g) => g.authorId));
  });
});

describe('diversify', () => {
  it('avoids back-to-back creators with the same primary topic when scores are close', () => {
    const out = diversify([
      { authorId: 'a', score: 1.0, primaryTag: 'travel' },
      { authorId: 'b', score: 0.95, primaryTag: 'travel' },
      { authorId: 'c', score: 0.9, primaryTag: 'food' },
    ]);
    expect(out.map((g) => g.authorId)).toEqual(['a', 'c', 'b']);
  });
  it('keeps order when the gap is large', () => {
    const out = diversify([
      { authorId: 'a', score: 1.0, primaryTag: 'travel' },
      { authorId: 'b', score: 0.99, primaryTag: 'travel' },
      { authorId: 'c', score: 0.1, primaryTag: 'food' },
    ]);
    expect(out.map((g) => g.authorId)).toEqual(['a', 'b', 'c']);
  });
  it('handles empty input', () => {
    expect(diversify([])).toEqual([]);
  });
});
