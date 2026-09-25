import { describe, expect, it } from 'vitest';
import {
  INTERSTITIAL,
  appendDiscover,
  buildQueue,
  currentStory,
  initialCursor,
  markSeen,
  next,
  nextGroup,
  prev,
  prevGroup,
  shouldLoadMore,
  storyDuration,
} from '../../client/src/lib/player.js';

const group = (id, n, extra = {}) => ({
  author: { id, username: id },
  stories: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, type: 'image', seenByMe: false })),
  startIndex: 0,
  hasUnseen: true,
  ...extra,
});

const feed = {
  me: group('me', 1),
  friends: [group('alice', 2), group('bob', 1, { hasUnseen: false })],
  discover: [group('zoe', 2), group('kai', 1)],
};

describe('buildQueue', () => {
  it('plays unseen friends, then a caught-up card, then For You', () => {
    const q = buildQueue(feed);
    expect(q.map((g) => g.kind)).toEqual(['friends', INTERSTITIAL, 'discover', 'discover']);
    expect(q[0].author.id).toBe('alice');
  });

  it('starts from a tapped friend and includes the rest of the tray', () => {
    const q = buildQueue(feed, { start: 'bob' });
    expect(q.map((g) => g.author?.id ?? g.kind)).toEqual(['bob', INTERSTITIAL, 'zoe', 'kai']);
  });

  it('starts with your own story when tapping "Your story"', () => {
    const q = buildQueue(feed, { start: 'me' });
    expect(q[0].kind).toBe('mine');
    expect(q[1].author.id).toBe('alice');
  });

  it('can jump straight into For You', () => {
    expect(buildQueue(feed, { start: 'discover' }).map((g) => g.author.id)).toEqual(['zoe', 'kai']);
    expect(buildQueue(feed, { start: 'discover:kai' }).map((g) => g.author.id)).toEqual(['kai']);
  });

  it('skips the caught-up card when there are no friends to watch', () => {
    const q = buildQueue({ ...feed, friends: [] });
    expect(q.map((g) => g.kind)).toEqual(['discover', 'discover']);
  });

  it('has no discover section when discovery is empty/off', () => {
    const q = buildQueue({ ...feed, discover: [] });
    expect(q.map((g) => g.kind)).toEqual(['friends']);
  });
});

describe('cursor navigation', () => {
  const q = buildQueue(feed); // alice(2), interstitial(1), zoe(2), kai(1)

  it('starts at the first group start index', () => {
    expect(initialCursor(q)).toEqual({ g: 0, s: 0 });
    expect(initialCursor([])).toBeNull();
    expect(initialCursor([group('x', 3, { startIndex: 2 })])).toEqual({ g: 0, s: 2 });
  });

  it('taps forward through every story in order and ends with null', () => {
    const seen = [];
    let c = initialCursor(q);
    while (c) {
      seen.push(currentStory(q, c).id);
      c = next(q, c);
    }
    expect(seen).toEqual(['alice-0', 'alice-1', 'caught-up', 'zoe-0', 'zoe-1', 'kai-0']);
  });

  it('taps back, crossing into the previous creator’s last story', () => {
    expect(prev(q, { g: 0, s: 1 })).toEqual({ g: 0, s: 0 });
    expect(prev(q, { g: 2, s: 0 })).toEqual({ g: 1, s: 0 });
    expect(prev(q, { g: 1, s: 0 })).toEqual({ g: 0, s: 1 });
    expect(prev(q, { g: 0, s: 0 })).toEqual({ g: 0, s: 0 });
  });

  it('skips and rewinds whole creators', () => {
    expect(nextGroup(q, { g: 0, s: 0 })).toEqual({ g: 1, s: 0 });
    expect(nextGroup(q, { g: 3, s: 0 })).toBeNull();
    expect(prevGroup(q, { g: 2, s: 1 })).toEqual({ g: 1, s: 0 });
    expect(prevGroup(q, { g: 0, s: 1 })).toEqual({ g: 0, s: 0 });
  });

  it('resumes a friend at their first unseen story', () => {
    const q2 = buildQueue({ friends: [group('a', 3, { startIndex: 2 }), group('b', 2, { startIndex: 1 })], discover: [] });
    expect(nextGroup(q2, { g: 0, s: 2 })).toEqual({ g: 1, s: 1 });
  });

  it('currentStory handles a null cursor', () => {
    expect(currentStory(q, null)).toBeNull();
  });
});

describe('appendDiscover & shouldLoadMore', () => {
  it('appends only new creators', () => {
    const q = buildQueue(feed);
    const out = appendDiscover(q, [group('kai', 1), group('ana', 1)]);
    expect(out.map((g) => g.author?.id ?? g.kind).slice(-3)).toEqual(['zoe', 'kai', 'ana']);
    expect(out.at(-1).kind).toBe('discover');
  });
  it('returns the same queue when nothing is new', () => {
    const q = buildQueue(feed);
    expect(appendDiscover(q, [group('zoe', 1)])).toBe(q);
  });
  it('adds a caught-up card before the first discover batch', () => {
    const q = buildQueue({ friends: [group('a', 1)], discover: [] });
    expect(appendDiscover(q, [group('z', 1)]).map((g) => g.kind)).toEqual(['friends', INTERSTITIAL, 'discover']);
  });
  it('requests more when near the end', () => {
    const q = buildQueue(feed);
    expect(shouldLoadMore(q, { g: 0, s: 0 })).toBe(false);
    expect(shouldLoadMore(q, { g: 1, s: 0 })).toBe(true);
    expect(shouldLoadMore(q, null)).toBe(false);
  });
});

describe('storyDuration', () => {
  it('uses the photo duration setting', () => {
    expect(storyDuration({ type: 'image' })).toBe(5000);
    expect(storyDuration({ type: 'image' }, { imageDurationSec: 10 })).toBe(10000);
  });
  it('uses video length, falling back to 15s', () => {
    expect(storyDuration({ type: 'video', durationMs: 8000 })).toBe(8000);
    expect(storyDuration({ type: 'video' })).toBe(15000);
  });
  it('gives long text stories more time, up to 12s', () => {
    expect(storyDuration({ type: 'text', text: 'hi' })).toBe(5000);
    expect(storyDuration({ type: 'text', text: 'x'.repeat(150) })).toBe(9000);
    expect(storyDuration({ type: 'text', text: 'x'.repeat(280) })).toBe(12000);
  });
  it('handles the interstitial and missing stories', () => {
    expect(storyDuration({ type: INTERSTITIAL })).toBe(4000);
    expect(storyDuration(null)).toBe(0);
  });
});

describe('markSeen', () => {
  it('marks a story seen and advances the group start index', () => {
    const groups = [group('a', 2), group('b', 1)];
    const out = markSeen(groups, 'a-0');
    expect(out[0].stories[0].seenByMe).toBe(true);
    expect(out[0].startIndex).toBe(1);
    expect(out[0].hasUnseen).toBe(true);
    expect(out[1]).toBe(groups[1]);
    const all = markSeen(out, 'a-1');
    expect(all[0].hasUnseen).toBe(false);
    expect(all[0].startIndex).toBe(0);
  });
});
