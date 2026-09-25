import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { requireAuth, HttpError } from './auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import storyRoutes from './routes/stories.js';
import feedRoutes from './routes/feed.js';
import highlightRoutes from './routes/highlights.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';
import messageRoutes from './routes/messages.js';
import { createUploader } from './uploads.js';

/**
 * Build the Express app. All external state (database, clock, upload dir) is
 * injected so tests can run against an in-memory store and a fake clock.
 */
export function createApp({
  db,
  secret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  uploadDir = path.resolve('data/uploads'),
  clientDir = null,
  now = () => Date.now(),
} = {}) {
  const app = express();
  const ctx = { db, secret, uploadDir, now, upload: createUploader(uploadDir) };
  ctx.auth = requireAuth({ db, secret });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api/users', userRoutes(ctx));
  app.use('/api/stories', storyRoutes(ctx));
  app.use('/api/feed', feedRoutes(ctx));
  app.use('/api/highlights', highlightRoutes(ctx));
  app.use('/api/settings', settingsRoutes(ctx));
  app.use('/api/notifications', notificationRoutes(ctx));
  app.use('/api/messages', messageRoutes(ctx));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  fs.mkdirSync(uploadDir, { recursive: true });
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d', fallthrough: false }));

  if (clientDir && fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 ? 'Something went wrong' : err.message,
      ...(err.field ? { field: err.field } : {}),
      ...(err.reason ? { reason: err.reason } : {}),
    });
  });

  return app;
}
