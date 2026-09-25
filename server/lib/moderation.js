/** Shared moderation rules (App Store Review Guideline 1.2 / Google Play UGC policy). */

export const TERMS_VERSION = '2026-09-25';

export const REPORT_REASONS = {
  spam: 'Spam or scam',
  nudity: 'Nudity or sexual content',
  harassment: 'Bullying or harassment',
  hate: 'Hate speech or symbols',
  violence: 'Violence or dangerous acts',
  self_harm: 'Suicide or self-harm',
  minor_safety: 'A child may be at risk',
  illegal: 'Illegal goods or activity',
  ip: 'Intellectual property violation',
  impersonation: 'Pretending to be someone else',
  other: 'Something else',
};

export const REPORT_TARGETS = ['story', 'user', 'message', 'reply'];

// A story reported by this many different people is hidden until reviewed.
export const AUTO_HIDE_THRESHOLD = 3;

export const MODERATION_ACTIONS = ['dismiss', 'remove', 'suspend', 'remove_and_suspend'];

export function isModerator(user, moderators = []) {
  return !!user && (user.role === 'moderator' || moderators.includes(user.username));
}

export const isSuspended = (user) => !!user?.suspended;

/** Hidden (pending review) or removed stories are only visible to their author. */
export const isStoryModerated = (story) => !!story?.moderation;

export function suspendedMessage(supportEmail) {
  return `This account has been suspended for violating our Community Guidelines. If you think this is a mistake, contact ${supportEmail}.`;
}
