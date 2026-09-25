import crypto from 'node:crypto';
import { withDefaults } from './settings.js';

export const newId = () => crypto.randomUUID();

export function getSettings(db, userId) {
  return withDefaults(db.find('settings', (s) => s.userId === userId)?.values);
}

export function followRecord(db, followerId, followeeId) {
  return db.find('follows', (f) => f.followerId === followerId && f.followeeId === followeeId);
}

export function isFollowing(db, followerId, followeeId) {
  return followRecord(db, followerId, followeeId)?.status === 'accepted';
}

export function isBlockedEitherWay(db, a, b) {
  return !!db.find(
    'blocks',
    (x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a),
  );
}

export function followingIds(db, userId) {
  return new Set(
    db.filter('follows', (f) => f.followerId === userId && f.status === 'accepted').map((f) => f.followeeId),
  );
}

/** Authors whose stories should never show up for this viewer. */
export function hiddenAuthorIds(db, viewerId) {
  const ids = new Set();
  for (const b of db.all('blocks')) {
    if (b.blockerId === viewerId) ids.add(b.blockedId);
    if (b.blockedId === viewerId) ids.add(b.blockerId);
  }
  for (const m of db.all('mutes')) if (m.muterId === viewerId) ids.add(m.mutedId);
  for (const n of db.all('notInterested')) if (n.userId === viewerId) ids.add(n.authorId);
  return ids;
}

/** Can the viewer see an author's profile content (highlights, stories)? */
export function canViewContent(db, viewerId, author) {
  if (!author) return false;
  if (viewerId === author.id) return true;
  if (isBlockedEitherWay(db, viewerId, author.id)) return false;
  if (getSettings(db, author.id).privacy.privateAccount) return isFollowing(db, viewerId, author.id);
  return true;
}

export function canViewStory(db, viewerId, story, { now, ignoreExpiry = false } = {}) {
  if (!story) return false;
  if (story.authorId === viewerId) return true;
  if (!ignoreExpiry && story.expiresAt <= now) return false;
  const author = db.find('users', (u) => u.id === story.authorId);
  if (!canViewContent(db, viewerId, author)) return false;
  if (story.audience === 'followers') return isFollowing(db, viewerId, story.authorId);
  return true;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    website: user.website,
    avatarUrl: user.avatarUrl,
    interests: user.interests,
    verified: !!user.verified,
    createdAt: user.createdAt,
  };
}

export function storyStats(db) {
  const stats = new Map();
  const get = (id) => {
    if (!stats.has(id)) stats.set(id, { views: 0, completions: 0, likes: 0, replies: 0 });
    return stats.get(id);
  };
  for (const v of db.all('views')) {
    const s = get(v.storyId);
    s.views++;
    if (v.completion >= 0.9) s.completions++;
  }
  for (const l of db.all('likes')) get(l.storyId).likes++;
  for (const r of db.all('replies')) get(r.storyId).replies++;
  return stats;
}

const NOTIFICATION_SETTING = {
  like: 'likes',
  reply: 'replies',
  follow: 'follows',
  follow_request: 'followRequests',
  follow_accepted: 'follows',
};

export function notify(db, { userId, type, actorId, storyId = null, text = null, now }) {
  if (userId === actorId) return null;
  const prefs = getSettings(db, userId).notifications;
  if (prefs.pauseAll || prefs[NOTIFICATION_SETTING[type]] === false) return null;
  return db.insert('notifications', {
    id: newId(),
    userId,
    type,
    actorId,
    storyId,
    text,
    createdAt: now,
    read: false,
  });
}
