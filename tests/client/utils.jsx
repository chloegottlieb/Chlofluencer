import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../../client/src/auth.jsx';
import { defaultSettings } from '../../server/lib/settings.js';

export const me = {
  id: 'me',
  username: 'demo',
  displayName: 'Demo User',
  email: 'demo@example.com',
  bio: '',
  website: '',
  avatarUrl: null,
  interests: ['travel'],
  settings: defaultSettings(),
};

/**
 * Mock `fetch` with a route table: { 'GET /feed': body | (req) => body }.
 * Unknown routes resolve to {}. Returns the mock so tests can inspect calls.
 */
export function mockApi(routes = {}) {
  const all = { 'GET /auth/me': { user: me }, 'GET /notifications': { notifications: [], unread: 0 }, ...routes };
  const fn = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const path = url.replace(/^\/api/, '').split('?')[0];
    const key = `${method} ${path}`;
    let handler = all[key];
    if (handler === undefined) {
      const match = Object.keys(all).find((k) => {
        const [m, p] = k.split(' ');
        if (m !== method) return false;
        const re = new RegExp(`^${p.replace(/:[^/]+/g, '[^/]+')}$`);
        return re.test(path);
      });
      handler = match ? all[match] : {};
    }
    let body = typeof handler === 'function' ? await handler({ url, method, body: init.body ? safeParse(init.body) : undefined }) : handler;
    let status = 200;
    if (body && body.__status) {
      status = body.__status;
      body = body.body;
    }
    return { ok: status < 400, status, json: async () => body };
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const safeParse = (b) => {
  try {
    return JSON.parse(b);
  } catch {
    return b;
  }
};

export const fail = (status, error) => ({ __status: status, body: { error } });

export function renderApp(ui, { route = '/', loggedIn = true } = {}) {
  if (loggedIn) localStorage.setItem('cf_token', 'test-token');
  else localStorage.removeItem('cf_token');
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}

export const calls = (fetchMock, method, pathRe) =>
  fetchMock.mock.calls.filter(([url, init = {}]) => (init.method ?? 'GET') === method && pathRe.test(url));
