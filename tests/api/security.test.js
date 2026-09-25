import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { rateLimit } from '../../server/security.js';
import { setup } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

describe('CORS for the native apps', () => {
  it.each(['capacitor://localhost', 'https://localhost', 'ionic://localhost'])('allows %s', async (origin) => {
    t = setup();
    const pre = await t.request().options('/api/auth/login').set('Origin', origin).set('Access-Control-Request-Method', 'POST');
    expect(pre.status).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe(origin);
    expect(pre.headers['access-control-allow-headers']).toMatch(/Authorization/);
    const res = await t.request().get('/api/health').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('does not allow unknown websites', async () => {
    t = setup();
    const pre = await t.request().options('/api/auth/login').set('Origin', 'https://evil.example');
    expect(pre.status).toBe(403);
    const res = await t.request().get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('security headers', () => {
  it('sets hardening headers and hides Express', async () => {
    t = setup();
    const res = await t.request().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('exposes the support email for the Help screen', async () => {
    t = setup();
    expect((await t.request().get('/api/config')).body).toEqual({ supportEmail: 'help@test.dev' });
  });
});

describe('rate limiting', () => {
  it('limits failed login attempts per IP', async () => {
    t = setup({ rateLimits: true });
    await t.signup('maya');
    let last;
    for (let i = 0; i < 31; i++) last = await t.request().post('/api/auth/login').send({ login: 'maya', password: 'wrong' });
    expect(last.status).toBe(429);
    expect(last.headers['retry-after']).toBeDefined();
    expect(last.body.error).toMatch(/Too many login attempts/);
  });

  it('limits account creation per IP', async () => {
    t = setup({ rateLimits: true });
    for (let i = 0; i < 10; i++) await t.signup(`user${i}`);
    const res = await t.request().post('/api/auth/signup').send({ username: 'onemore', email: 'o@example.com', password: 'password1', acceptTerms: true });
    expect(res.status).toBe(429);
  });

  it('fixed window resets after the window passes', async () => {
    let now = 0;
    const app = express();
    app.use(rateLimit({ windowMs: 1000, max: 2, now: () => now }));
    app.get('/', (_req, res) => res.send('ok'));
    app.use((err, _req, res, _next) => res.status(err.status).send(err.message));
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/')).status).toBe(429);
    now = 1500;
    expect((await request(app).get('/')).status).toBe(200);
  });
});
