import { getSettings, publicUser } from './social.js';

/**
 * Shape a story for a given viewer. View/like counts are only included for
 * the owner, or when the owner allows public counts.
 */
export function serializeStory(db, story, viewerId, { stats, now } = {}) {
  const author = db.find('users', (u) => u.id === story.authorId);
  const isOwner = viewerId === story.authorId;
  const authorSettings = getSettings(db, story.authorId);
  const out = {
    id: story.id,
    author: publicUser(author),
    type: story.type,
    mediaUrl: story.mediaUrl,
    text: story.text,
    background: story.background,
    caption: story.caption,
    tags: story.tags,
    audience: story.audience,
    allowDiscovery: story.allowDiscovery,
    sensitive: !!story.sensitive,
    durationMs: story.durationMs,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    expired: now !== undefined ? story.expiresAt <= now : undefined,
    isOwner,
    likesEnabled: authorSettings.stories.allowLikes,
    repliesSetting: authorSettings.privacy.storyReplies,
    likedByMe: !!db.find('likes', (l) => l.storyId === story.id && l.userId === viewerId),
    seenByMe: !!db.find('views', (v) => v.storyId === story.id && v.viewerId === viewerId),
  };
  if (isOwner || authorSettings.privacy.showViewCounts) {
    const s = stats?.get(story.id);
    out.viewCount = s?.views ?? db.filter('views', (v) => v.storyId === story.id).length;
    out.likeCount = s?.likes ?? db.filter('likes', (l) => l.storyId === story.id).length;
  }
  return out;
}
