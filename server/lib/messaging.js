import { isBlockedEitherWay, isFollowing } from './social.js';

/**
 * Direct messaging rules:
 *  - Two people who follow each other ("mutuals") can DM freely, and story
 *    replies between them land in their conversation.
 *  - Anyone else can only send one-way story replies, which the creator
 *    reads in their Story replies inbox but can't answer.
 *  - A conversation that loses its mutual follow (or gets blocked) becomes
 *    read-only; the history stays but nobody can send.
 */

export const conversationId = (a, b) => [a, b].sort().join(':');

export function isMutual(db, a, b) {
  return a !== b && isFollowing(db, a, b) && isFollowing(db, b, a);
}

export const MESSAGING_REASONS = {
  mutual: null,
  self: "You can't message yourself",
  unavailable: 'This account is unavailable',
  blocked: "You can't message this account",
  not_mutual: 'You can message people once you both follow each other',
};

export function messagingStatus(db, meId, otherId) {
  let reason = 'mutual';
  if (meId === otherId) reason = 'self';
  else if (db.find('users', (u) => u.id === otherId)?.suspended) reason = 'unavailable';
  else if (isBlockedEitherWay(db, meId, otherId)) reason = 'blocked';
  else if (!isMutual(db, meId, otherId)) reason = 'not_mutual';
  return { canMessage: reason === 'mutual', reason, message: MESSAGING_REASONS[reason] };
}
