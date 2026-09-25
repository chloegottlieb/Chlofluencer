import { getSettings } from './social.js';
import { removeUpload } from '../uploads.js';

/**
 * Stories disappear from the feed after 24h regardless. Afterwards they are
 * kept in the owner's private archive unless the owner turned archiving off,
 * in which case they're deleted — except for stories saved to a highlight.
 */
export function purgeExpiredStories(db, now, uploadDir) {
  const highlighted = new Set(db.all('highlights').flatMap((h) => h.storyIds));
  const doomed = db.filter(
    'stories',
    (s) => s.expiresAt <= now && !highlighted.has(s.id) && !getSettings(db, s.authorId).stories.saveToArchive,
  );
  if (!doomed.length) return 0;
  const ids = new Set(doomed.map((s) => s.id));
  for (const s of doomed) removeUpload(uploadDir, s.mediaUrl);
  db.remove('stories', (s) => ids.has(s.id));
  db.remove('views', (v) => ids.has(v.storyId));
  db.remove('likes', (l) => ids.has(l.storyId));
  return doomed.length;
}
