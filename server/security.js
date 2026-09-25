import { HttpError } from './auth.js';

/** Allow the native apps (and any configured web origins) to call the API. */
export function cors(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && allowed.has(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(origin && allowed.has(origin) ? 204 : 403);
    next();
  };
}

export function securityHeaders({ hsts = false } = {}) {
  return (_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    if (hsts) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

/**
 * Fixed-window in-memory rate limiter (fine for a single server).
 * `key(req)` picks what to count by — IP for login, user id for posting.
 */
export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many requests. Please slow down.', now = () => Date.now() }) {
  const hits = new Map();
  let lastSweep = now();
  return (req, res, next) => {
    const t = now();
    if (t - lastSweep > windowMs) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      lastSweep = t;
    }
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(k, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      return next(new HttpError(429, message));
    }
    next();
  };
}

const passthrough = (_req, _res, next) => next();

/** The limits used by the app; `enabled: false` turns them all off (e2e tests). */
export function appRateLimits({ enabled = true, now } = {}) {
  if (!enabled) return { auth: passthrough, signup: passthrough, write: passthrough };
  return {
    auth: rateLimit({ windowMs: 15 * 60_000, max: 30, now, message: 'Too many login attempts. Try again in a few minutes.' }),
    signup: rateLimit({ windowMs: 60 * 60_000, max: 10, now, message: 'Too many new accounts from this network. Try again later.' }),
    // Per signed-in user, across posting, messaging, reporting, following…
    write: rateLimit({ windowMs: 60_000, max: 120, key: (req) => req.user?.id ?? req.ip, now }),
  };
}
