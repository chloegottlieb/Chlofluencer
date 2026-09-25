export const LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  displayNameMax: 50,
  bioMax: 150,
  passwordMin: 8,
  captionMax: 200,
  storyTextMax: 280,
  replyMax: 500,
  highlightTitleMax: 30,
  maxTags: 10,
  maxInterests: 15,
};

const USERNAME_RE = /^[a-z0-9._]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_OR_GRADIENT_RE = /^(#[0-9a-fA-F]{3,8}|linear-gradient\([^;{}<>]*\))$/;

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.field = field;
  }
}

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (username.length < LIMITS.usernameMin || username.length > LIMITS.usernameMax) {
    return `Username must be ${LIMITS.usernameMin}-${LIMITS.usernameMax} characters`;
  }
  if (!USERNAME_RE.test(username)) {
    return 'Username may only contain letters, numbers, periods and underscores';
  }
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
    return 'Username cannot start or end with a period or contain consecutive periods';
  }
  return null;
}

export function validateEmail(value) {
  const email = String(value ?? '').trim();
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address';
  return null;
}

export function validatePassword(value) {
  const password = String(value ?? '');
  if (password.length < LIMITS.passwordMin) {
    return `Password must be at least ${LIMITS.passwordMin} characters`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  return null;
}

export function validateBio(value) {
  if (String(value ?? '').length > LIMITS.bioMax) {
    return `Bio must be ${LIMITS.bioMax} characters or fewer`;
  }
  return null;
}

export function validateWebsite(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    return null;
  } catch {
    return 'Website must be a valid http(s) URL';
  }
}

/** Normalises a list of tags/interests: lowercase, strip '#', dedupe, cap. */
export function normalizeTags(input, max = LIMITS.maxTags) {
  let list = input;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = list.split(/[\s,]+/);
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const raw of list) {
    const tag = String(raw ?? '')
      .trim()
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (tag && tag.length <= 30) seen.add(tag);
    if (seen.size >= max) break;
  }
  return [...seen];
}

export function isSafeBackground(value) {
  return HEX_OR_GRADIENT_RE.test(String(value ?? ''));
}

export function assertValid(error, field) {
  if (error) throw new ValidationError(error, field);
}
