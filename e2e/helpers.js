import { expect } from '@playwright/test';

let counter = 0;
export const uniqueName = (prefix = 'u') => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`.slice(0, 30);

/** Create an account through the API. */
export async function apiSignup(request, prefix = 'user', extra = {}) {
  const username = uniqueName(prefix);
  const res = await request.post('/api/auth/signup', {
    data: { username, email: `${username}@example.com`, password: 'password123', ...extra },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { ...body, username };
}

export async function apiLogin(request, login, password = 'password123') {
  const res = await request.post('/api/auth/login', { data: { login, password } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

export function authed(request, token) {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get: (url) => request.get(`/api${url}`, { headers }),
    post: (url, data) => request.post(`/api${url}`, { headers, data }),
    patch: (url, data) => request.patch(`/api${url}`, { headers, data }),
    delete: (url) => request.delete(`/api${url}`, { headers }),
  };
}

export async function apiPostStory(request, token, fields = {}) {
  const res = await authed(request, token).post('/stories', { text: 'Hello from e2e', ...fields });
  expect(res.status()).toBe(201);
  return (await res.json()).story;
}

/** Open the app already logged in with the given token. */
export async function openAs(page, token, path = '/') {
  await page.addInitScript((t) => window.localStorage.setItem('storytime_token', t), token);
  await page.goto(path);
}

export const viewer = (page) => page.getByTestId('story-viewer');
/** Username of the creator currently playing (without the verified badge). */
export const currentAuthor = (page) => viewer(page).getAttribute('data-author');
export const tapNext = (page) => page.getByRole('button', { name: 'Next story' }).click();
export const tapPrev = (page) => page.getByRole('button', { name: 'Previous story' }).click();
