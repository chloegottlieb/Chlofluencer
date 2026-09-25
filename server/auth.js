import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(String(password ?? ''), hash);
}

export function signToken(user, secret) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion ?? 0 }, secret, { expiresIn: '30d' });
}

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

/** Express middleware that attaches req.user or responds 401. */
export function requireAuth({ db, secret }) {
  return (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next(new HttpError(401, 'Authentication required'));
    try {
      const payload = jwt.verify(token, secret);
      const user = db.find('users', (u) => u.id === payload.sub);
      if (!user || (user.tokenVersion ?? 0) !== payload.tv) throw new Error('stale');
      if (!user.lastActiveAt || Date.now() - user.lastActiveAt > 60_000) {
        db.update('users', (u) => u.id === user.id, { lastActiveAt: Date.now() });
      }
      req.user = user;
      next();
    } catch {
      next(new HttpError(401, 'Session expired, please log in again'));
    }
  };
}
