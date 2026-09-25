import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

let t;
beforeEach(() => (t = setup()));
afterEach(() => t.cleanup());

describe('POST /api/auth/signup', () => {
  it('creates an account and returns a token + profile with default settings', async () => {
    const res = await t.request().post('/api/auth/signup').send({
      username: 'Maya.Travels',
      email: 'Maya@Example.com',
      password: 'password1',
      displayName: 'Maya',
      interests: ['#Travel', 'food'],
      acceptTerms: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({
      username: 'maya.travels',
      email: 'maya@example.com',
      displayName: 'Maya',
      interests: ['travel', 'food'],
      avatarUrl: null,
    });
    expect(res.body.user.settings.discovery.showDiscover).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('defaults display name to the username', async () => {
    const { user } = await t.signup('leo');
    expect(user.displayName).toBe('leo');
  });

  it.each([
    [{ username: 'ab' }, 'username'],
    [{ email: 'bad' }, 'email'],
    [{ password: 'short' }, 'password'],
  ])('validates %j', async (override, field) => {
    const res = await t
      .request()
      .post('/api/auth/signup')
      .send({ username: 'valid', email: 'v@example.com', password: 'password1', acceptTerms: true, ...override });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe(field);
  });

  it('rejects duplicate usernames and emails', async () => {
    await t.signup('taken');
    const dupUser = await t.request().post('/api/auth/signup').send({ username: 'TAKEN', email: 'x@example.com', password: 'password1', acceptTerms: true });
    expect(dupUser.status).toBe(409);
    expect(dupUser.body.field).toBe('username');
    const dupEmail = await t.request().post('/api/auth/signup').send({ username: 'other', email: 'taken@example.com', password: 'password1', acceptTerms: true });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.field).toBe('email');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in by username or email, case-insensitively', async () => {
    await t.signup('priya');
    for (const login of ['priya', 'PRIYA', 'priya@example.com']) {
      const res = await t.request().post('/api/auth/login').send({ login, password: 'password1' });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('priya');
    }
  });

  it('rejects wrong credentials with a generic message', async () => {
    await t.signup('priya');
    const wrongPw = await t.request().post('/api/auth/login').send({ login: 'priya', password: 'nope12345' });
    const noUser = await t.request().post('/api/auth/login').send({ login: 'ghost', password: 'password1' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error).toBe(noUser.body.error);
  });
});

describe('auth middleware', () => {
  it('GET /me requires a valid token', async () => {
    expect((await t.request().get('/api/auth/me')).status).toBe(401);
    expect((await t.as('garbage').get('/auth/me')).status).toBe(401);
    const { api } = await t.signup('kai');
    const me = await api.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('kai');
  });

  it('logout-everywhere invalidates existing tokens', async () => {
    const { api } = await t.signup('kai');
    expect((await api.post('/auth/logout-everywhere')).status).toBe(200);
    expect((await api.get('/auth/me')).status).toBe(401);
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await t.request().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('health check is public', async () => {
    expect((await t.request().get('/api/health')).body).toEqual({ ok: true });
  });
});
