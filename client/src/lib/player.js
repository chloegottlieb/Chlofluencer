/**
 * Pure helpers that turn a feed into one continuous tap-through queue and
 * move a cursor through it. The queue is a list of "groups" (one creator's
 * stories each); the cursor is { g, s } = group index + story index.
 */

export const INTERSTITIAL = 'interstitial';

export function interstitialGroup() {
  return {
    kind: INTERSTITIAL,
    key: 'caught-up',
    author: null,
    stories: [{ id: 'caught-up', type: INTERSTITIAL }],
    startIndex: 0,
  };
}

const tag = (kind) => (group) => ({ ...group, kind, key: `${kind}:${group.author.id}` });

/**
 * Build the viewing queue.
 *  - start: 'me' | author id of a friend | 'discover' | 'discover:<authorId>'
 *           | undefined (first friend with unseen stories)
 * Friends come first (from the tapped friend onward), then a "you're all
 * caught up" card, then For You recommendations from strangers.
 */
export function buildQueue(feed, { start } = {}) {
  const queue = [];
  const friends = (feed.friends ?? []).map(tag('friends'));
  const discover = (feed.discover ?? []).map(tag('discover'));

  if (start === 'me' && feed.me?.stories?.length) {
    queue.push({ ...tag('mine')(feed.me), startIndex: 0 });
    queue.push(...friends);
  } else if (start === 'discover') {
    // Jump straight into For You, skipping friends.
  } else if (typeof start === 'string' && start.startsWith('discover:')) {
    const idx = discover.findIndex((g) => g.author.id === start.slice('discover:'.length));
    return idx === -1 ? discover : discover.slice(idx);
  } else if (start) {
    const idx = friends.findIndex((g) => g.author.id === start);
    queue.push(...(idx === -1 ? friends : friends.slice(idx)));
  } else {
    queue.push(...friends.filter((g) => g.hasUnseen));
  }

  if (discover.length) {
    if (queue.length) queue.push(interstitialGroup());
    queue.push(...discover);
  }
  return queue;
}

/** Append more discover groups, skipping authors already queued. */
export function appendDiscover(queue, groups) {
  const present = new Set(queue.filter((g) => g.kind === 'discover').map((g) => g.author.id));
  const fresh = groups.filter((g) => !present.has(g.author.id)).map(tag('discover'));
  if (!fresh.length) return queue;
  const next = [...queue];
  if (!next.some((g) => g.kind === 'discover' || g.kind === INTERSTITIAL) && next.length) next.push(interstitialGroup());
  next.push(...fresh);
  return next;
}

export function initialCursor(queue) {
  if (!queue.length) return null;
  return { g: 0, s: clampIndex(queue[0].startIndex ?? 0, queue[0]) };
}

function clampIndex(i, group) {
  return Math.max(0, Math.min(i, group.stories.length - 1));
}

export function currentStory(queue, cursor) {
  if (!cursor) return null;
  return queue[cursor.g]?.stories[cursor.s] ?? null;
}

/** Advance one story. Returns null when the queue is finished. */
export function next(queue, cursor) {
  const group = queue[cursor.g];
  if (cursor.s + 1 < group.stories.length) return { g: cursor.g, s: cursor.s + 1 };
  return nextGroup(queue, cursor);
}

/** Go back one story; stays put at the very beginning. */
export function prev(queue, cursor) {
  if (cursor.s > 0) return { g: cursor.g, s: cursor.s - 1 };
  if (cursor.g > 0) {
    const g = cursor.g - 1;
    return { g, s: queue[g].stories.length - 1 };
  }
  return { ...cursor };
}

/** Skip the rest of this creator's stories. */
export function nextGroup(queue, cursor) {
  const g = cursor.g + 1;
  if (g >= queue.length) return null;
  return { g, s: clampIndex(queue[g].startIndex ?? 0, queue[g]) };
}

export function prevGroup(queue, cursor) {
  if (cursor.g === 0) return { g: 0, s: 0 };
  return { g: cursor.g - 1, s: 0 };
}

/** Should we fetch more discover stories? True when few groups remain. */
export function shouldLoadMore(queue, cursor, threshold = 2) {
  if (!cursor) return false;
  return queue.length - 1 - cursor.g <= threshold;
}

/** How long a story plays, in ms. */
export function storyDuration(story, { imageDurationSec = 5 } = {}) {
  if (!story) return 0;
  if (story.type === INTERSTITIAL) return 4000;
  if (story.type === 'video') return story.durationMs ?? 15000;
  if (story.type === 'text') return Math.max(imageDurationSec * 1000, Math.min(12000, (story.text?.length ?? 0) * 60));
  return imageDurationSec * 1000;
}

/** Marks a story seen inside feed groups (immutable). */
export function markSeen(groups, storyId) {
  return groups.map((g) => {
    if (!g.stories.some((s) => s.id === storyId)) return g;
    const stories = g.stories.map((s) => (s.id === storyId ? { ...s, seenByMe: true } : s));
    const firstUnseen = stories.findIndex((s) => !s.seenByMe);
    return { ...g, stories, hasUnseen: firstUnseen !== -1, startIndex: firstUnseen === -1 ? 0 : firstUnseen };
  });
}
