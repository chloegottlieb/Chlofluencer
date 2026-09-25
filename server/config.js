import path from 'node:path';

export const DEV_SECRET = 'dev-only-secret-change-me';

// Origins used by the Capacitor native shells (iOS / Android) and local dev.
export const NATIVE_APP_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'https://localhost', 'http://localhost'];

const list = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Read and validate configuration from environment variables. */
export function loadConfig(env = process.env, { root = process.cwd() } = {}) {
  const isProd = env.NODE_ENV === 'production';
  const dataDir = path.resolve(env.DATA_DIR ?? path.join(root, 'data'));
  const jwtSecret = env.JWT_SECRET ?? (isProd ? null : DEV_SECRET);
  if (isProd && (!jwtSecret || jwtSecret === DEV_SECRET || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
  }
  return {
    isProd,
    port: Number(env.PORT ?? 4000),
    dataDir,
    dbFile: path.join(dataDir, 'storytime.sqlite'),
    legacyJsonFile: path.join(dataDir, 'db.json'),
    uploadDir: path.join(dataDir, 'uploads'),
    clientDir: path.join(root, 'dist'),
    jwtSecret,
    // Demo data is on by default locally and off in production.
    seed: env.SEED ? env.SEED !== 'false' : !isProd,
    corsOrigins: [...NATIVE_APP_ORIGINS, ...list(env.CORS_ORIGINS)],
    trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY !== 'false' : isProd,
    rateLimits: env.RATE_LIMITS !== 'off',
    // Usernames that are always moderators (comma-separated).
    moderators: list(env.MODERATOR_USERNAMES).map((u) => u.toLowerCase()),
    supportEmail: env.SUPPORT_EMAIL ?? 'support@example.com',
  };
}
