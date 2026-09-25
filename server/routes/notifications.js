import { Router } from 'express';
import { publicUser } from '../lib/social.js';

export default function notificationRoutes({ db, auth }) {
  const router = Router();
  router.use(auth);

  router.get('/', (req, res) => {
    const notifications = db
      .filter('notifications', (n) => n.userId === req.user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100)
      .map((n) => ({ ...n, actor: n.actorId ? publicUser(db.find('users', (u) => u.id === n.actorId)) : null }))
      // System notices (moderation outcomes) have no actor; drop ones whose actor was deleted.
      .filter((n) => n.actor || !n.actorId);
    res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
  });

  router.post('/read', (req, res) => {
    db.updateMany('notifications', (n) => n.userId === req.user.id && !n.read, { read: true });
    res.json({ ok: true });
  });

  return router;
}
