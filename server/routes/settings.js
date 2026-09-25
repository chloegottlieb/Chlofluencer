import { Router } from 'express';
import { HttpError, hashPassword, verifyPassword, signToken } from '../auth.js';
import { mergeSettings, SETTINGS_SCHEMA } from '../lib/settings.js';
import { getSettings } from '../lib/social.js';
import { assertValid, validatePassword } from '../lib/validation.js';

export default function settingsRoutes({ db, auth, secret }) {
  const router = Router();
  router.use(auth);

  router.get('/', (req, res) => {
    res.json({ settings: getSettings(db, req.user.id), schema: SETTINGS_SCHEMA });
  });

  router.patch('/', (req, res) => {
    const current = getSettings(db, req.user.id);
    const { settings, errors } = mergeSettings(current, req.body);
    if (errors.length) throw new HttpError(400, errors.join('; '));

    // Switching from private to public auto-approves pending follow requests.
    if (current.privacy.privateAccount && !settings.privacy.privateAccount) {
      for (const f of db.filter('follows', (f) => f.followeeId === req.user.id && f.status === 'pending')) {
        f.status = 'accepted';
      }
    }
    if (db.find('settings', (s) => s.userId === req.user.id)) {
      db.update('settings', (s) => s.userId === req.user.id, { values: settings });
    } else {
      db.insert('settings', { userId: req.user.id, values: settings });
    }
    res.json({ settings });
  });

  router.post('/password', (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!verifyPassword(currentPassword, req.user.passwordHash)) {
      throw new HttpError(403, 'Current password is incorrect', { field: 'currentPassword' });
    }
    assertValid(validatePassword(newPassword), 'newPassword');
    const user = db.update('users', (u) => u.id === req.user.id, (u) => ({
      passwordHash: hashPassword(newPassword),
      tokenVersion: (u.tokenVersion ?? 0) + 1,
    }));
    // Changing the password signs out every other device; hand back a fresh token.
    res.json({ ok: true, token: signToken(user, secret) });
  });

  router.post('/reset-recommendations', (req, res) => {
    const id = req.user.id;
    db.remove('notInterested', (n) => n.userId === id);
    // Forget discovery watch history so the For You ranking starts fresh.
    db.remove('views', (v) => v.viewerId === id && v.source === 'discover');
    res.json({ ok: true });
  });

  return router;
}
