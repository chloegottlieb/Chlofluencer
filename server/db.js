import fs from 'node:fs';
import path from 'node:path';

export const COLLECTIONS = [
  'users',
  'follows',
  'stories',
  'views',
  'likes',
  'replies',
  'messages',
  'highlights',
  'blocks',
  'mutes',
  'notInterested',
  'notifications',
  'settings',
];

function emptyData() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
}

/**
 * Tiny JSON-file document store. Everything lives in memory and is flushed to
 * disk (atomically, via a temp file) after each write. Pass `file: null` for a
 * purely in-memory store (used by tests).
 */
export function createDb({ file = null } = {}) {
  let data = emptyData();

  if (file && fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    data = { ...emptyData(), ...parsed };
  }

  function persist() {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }

  const db = {
    get data() {
      return data;
    },
    all(name) {
      return data[name];
    },
    find(name, predicate) {
      return data[name].find(predicate) ?? null;
    },
    filter(name, predicate) {
      return data[name].filter(predicate);
    },
    insert(name, doc) {
      data[name].push(doc);
      persist();
      return doc;
    },
    update(name, predicate, patch) {
      const doc = data[name].find(predicate);
      if (!doc) return null;
      Object.assign(doc, typeof patch === 'function' ? patch(doc) : patch);
      persist();
      return doc;
    },
    remove(name, predicate) {
      const before = data[name].length;
      data[name] = data[name].filter((doc) => !predicate(doc));
      const removed = before - data[name].length;
      if (removed) persist();
      return removed;
    },
    isEmpty() {
      return data.users.length === 0;
    },
    reset() {
      data = emptyData();
      persist();
    },
    persist,
  };
  return db;
}
