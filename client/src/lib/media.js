/**
 * The API origin. Empty on the web (same origin as the site); set at build
 * time for the native apps, e.g. VITE_API_URL=https://storytime-app.fly.dev
 */
export const API_ORIGIN = String(import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Turn a server path like "/uploads/x.jpg" into a loadable URL. */
export function mediaUrl(url) {
  if (!url) return url;
  if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
  return url;
}
