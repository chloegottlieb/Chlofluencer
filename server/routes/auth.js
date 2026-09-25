import { Router } from 'express';
import { hashPassword, verifyPassword, signToken, HttpError } from '../auth.js';
import {
  assertValid,
  normalizeTags,
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
  LIMITS,
} from '../lib/validation.js';
import { newId, publicUser, getSettings } from '../lib/social.js';
import { defaultSettings } from '../lib/settings.js';
import { TERMS_VERSION, isModerator, suspendedMessage } from '../lib/moderation.js';
import { assertClean } from '../lib/contentFilter.js';

export function selfUser(db, user, moderators = []) {
  return {
    ...publicUser(user),
    email: user.email,
    settings: getSettings(db, user.id),
    isModerator: isModerator(user, moderators),
    // Existing users are asked to accept new terms when they change.
    needsTermsAcceptance: user.termsVersion !== TERMS_VERSION,
  };
}

export default function authRoutes({ db, secret, auth, now, limits, moderators, supportEmail }) {
  const router = Router();

  router.post('/signup', limits.signup, (req, res) => {
    const { username, email, password, displayName, interests, acceptTerms } = req.body ?? {};
    assertValid(validateUsername(username), 'username');
    assertValid(validateEmail(email), 'email');
    assertValid(validatePassword(password), 'password');
    assertClean({ username, displayName });
    if (acceptTerms !== true) {
      throw new HttpError(400, 'Please agree to the Terms of Use and Community Guidelines', { field: 'acceptTerms' });
    }
    const uname = normalizeUsername(username);
    const mail = String(email).trim().toLowerCase();
    if (db.find('users', (u) => u.username === uname)) throw new HttpError(409, 'That username is taken', { field: 'username' });
    if (db.find('users', (u) => u.email === mail)) throw new HttpError(409, 'An account with that email already exists', { field: 'email' });

    const user = db.insert('users', {
      id: newId(),
      username: uname,
      email: mail,
      passwordHash: hashPassword(password),
      displayName: String(displayName || uname).trim().slice(0, LIMITS.displayNameMax),
      bio: '',
      website: '',
      avatarUrl: null,
      interests: normalizeTags(interests, LIMITS.maxInterests),
      verified: false,
      role: 'user',
      suspended: null,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now(),
      tokenVersion: 0,
      createdAt: now(),
    });
    db.insert('settings', { userId: user.id, values: defaultSettings() });
    res.status(201).json({ token: signToken(user, secret), user: selfUser(db, user, moderators) });
  });

  router.post('/login', limits.auth, (req, res) => {
    const { login, password } = req.body ?? {};
    const key = String(login ?? '').trim().toLowerCase();
    const user = db.find('users', (u) => u.username === key || u.email === key);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, 'Incorrect username or password');
    }
    if (user.suspended) throw new HttpError(403, suspendedMessage(supportEmail), { reason: 'suspended' });
    res.json({ token: signToken(user, secret), user: selfUser(db, user, moderators) });
  });

  router.get('/me', auth, (req, res) => {
    res.json({ user: selfUser(db, req.user, moderators) });
  });

  router.post('/accept-terms', auth, (req, res) => {
    const user = db.update('users', (u) => u.id === req.user.id, { termsVersion: TERMS_VERSION, termsAcceptedAt: now() });
    res.json({ user: selfUser(db, user, moderators) });
  });

  router.post('/logout-everywhere', auth, (req, res) => {
    db.update('users', (u) => u.id === req.user.id, (u) => ({ tokenVersion: (u.tokenVersion ?? 0) + 1 }));
    res.json({ ok: true });
  });

  return router;
}
