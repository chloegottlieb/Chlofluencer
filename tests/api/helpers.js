import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { createDb } from '../../server/db.js';

export const HOUR = 3600_000;
export const T0 = 1_800_000_000_000;

// Smallest valid PNG (1x1 transparent pixel).
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** Spin up an isolated app with an in-memory DB and a controllable clock. */
export function setup({ rateLimits = false, moderators = [] } = {}) {
  const db = createDb();
  const clock = { now: T0 };
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-uploads-'));
  const app = createApp({ db, secret: 'test-secret', uploadDir, now: () => clock.now, rateLimits, moderators, supportEmail: 'help@test.dev' });

  const as = (token) => {
    const wrap = (method) => (url) => {
      const req = request(app)[method](`/api${url}`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };
    return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), delete: wrap('delete') };
  };

  let n = 0;
  async function signup(username = `user${++n}`, extra = {}) {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username, email: `${username}@example.com`, password: 'password1', acceptTerms: true, ...extra });
    if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
    return { ...res.body, api: as(res.body.token) };
  }

  async function postStory(user, fields = {}) {
    const res = await user.api.post('/stories').send({ text: 'hello world', ...fields });
    if (res.status !== 201) throw new Error(`story failed: ${JSON.stringify(res.body)}`);
    return res.body.story;
  }

  const cleanup = () => fs.rmSync(uploadDir, { recursive: true, force: true });

  return { app, db, clock, uploadDir, as, signup, postStory, cleanup, request: () => request(app) };
}
