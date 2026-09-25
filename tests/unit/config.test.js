import { describe, expect, it } from 'vitest';
import { DEV_SECRET, NATIVE_APP_ORIGINS, loadConfig } from '../../server/config.js';

const SECRET = 'x'.repeat(40);

describe('loadConfig', () => {
  it('has safe local defaults', () => {
    const c = loadConfig({}, { root: '/app' });
    expect(c).toMatchObject({
      isProd: false,
      port: 4000,
      dataDir: '/app/data',
      dbFile: '/app/data/storytime.sqlite',
      uploadDir: '/app/data/uploads',
      jwtSecret: DEV_SECRET,
      seed: true,
      trustProxy: false,
      rateLimits: true,
    });
    expect(c.corsOrigins).toEqual(NATIVE_APP_ORIGINS);
  });

  it('refuses to start in production without a strong JWT secret', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: DEV_SECRET })).toThrow(/JWT_SECRET/);
  });

  it('uses production defaults: no demo data, behind a proxy', () => {
    const c = loadConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET, DATA_DIR: '/data', PORT: '8080' });
    expect(c).toMatchObject({ isProd: true, seed: false, trustProxy: true, port: 8080, dbFile: '/data/storytime.sqlite' });
  });

  it('parses lists and switches', () => {
    const c = loadConfig({
      CORS_ORIGINS: 'https://storytime.app, https://www.storytime.app',
      MODERATOR_USERNAMES: 'Alice,bob',
      RATE_LIMITS: 'off',
      SEED: 'false',
      SUPPORT_EMAIL: 'help@storytime.app',
    });
    expect(c.corsOrigins).toEqual([...NATIVE_APP_ORIGINS, 'https://storytime.app', 'https://www.storytime.app']);
    expect(c.moderators).toEqual(['alice', 'bob']);
    expect(c.rateLimits).toBe(false);
    expect(c.seed).toBe(false);
    expect(c.supportEmail).toBe('help@storytime.app');
  });
});
