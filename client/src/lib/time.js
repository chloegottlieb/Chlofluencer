const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Compact Instagram-style relative time: "now", "5m", "3h", "2d", "4w". */
export function timeAgo(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  if (diff < MIN) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return `${Math.floor(diff / (7 * DAY))}w`;
}

/** Time remaining before a story disappears, e.g. "23h left". */
export function timeLeft(expiresAt, now = Date.now()) {
  const diff = expiresAt - now;
  if (diff <= 0) return 'Expired';
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MIN))}m left`;
  return `${Math.floor(diff / HOUR)}h left`;
}

export function formatCount(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
