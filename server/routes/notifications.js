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
      .map((n) => ({ ...n, actor: publicUser(db.find('users', (u) => u.id === n.actorId)) }))
      .filter((n) => n.actor);
    res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
  });

  router.post('/read', (req, res) => {
    for (const n of db.filter('notifications', (n) => n.userId === req.user.id && !n.read)) n.read = true;
    db.persist();
    res.json({ ok: true });
  });

  return router;
}
