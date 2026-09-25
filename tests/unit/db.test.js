import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, createDb, migrateJsonToSqlite } from '../../server/db.js';

const tmpDirs = [];
const tmpFile = (name) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-db-'));
  tmpDirs.push(dir);
  return path.join(dir, name);
};
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function exercise(db) {
  db.insert('users', { id: '1', name: 'a' });
  db.insert('users', { id: '2', name: 'b' });
  expect(db.find('users', (u) => u.id === '2').name).toBe('b');
  expect(db.find('users', (u) => u.id === '3')).toBeNull();
  expect(db.filter('users', (u) => u.id !== '1')).toHaveLength(1);
  expect(db.update('users', (u) => u.id === '1', { name: 'z' }).name).toBe('z');
  expect(db.update('users', (u) => u.id === '1', (u) => ({ name: u.name + '!' })).name).toBe('z!');
  expect(db.update('users', (u) => u.id === 'nope', { name: 'x' })).toBeNull();
  expect(db.updateMany('users', () => true, { flag: true })).toBe(2);
  expect(db.remove('users', (u) => u.id === '2')).toBe(1);
  expect(db.remove('users', (u) => u.id === 'nope')).toBe(0);
}

describe('in-memory db', () => {
  it('starts empty with every collection', () => {
    const db = createDb();
    for (const c of COLLECTIONS) expect(db.all(c)).toEqual([]);
    expect(db.isEmpty()).toBe(true);
  });

  it('supports insert / find / filter / update / updateMany / remove', () => {
    const db = createDb();
    exercise(db);
    expect(db.all('users')).toEqual([{ id: '1', name: 'z!', flag: true }]);
    expect(db.isEmpty()).toBe(false);
    db.reset();
    expect(db.isEmpty()).toBe(true);
  });
});

describe.each([['sqlite', 'db.sqlite'], ['json', 'db.json']])('%s-backed db', (_kind, name) => {
  it('persists every kind of write across restarts', () => {
    const file = tmpFile(name);
    const db = createDb({ file });
    exercise(db);
    db.insert('follows', { followerId: 'a', followeeId: 'b', status: 'pending' });
    db.updateMany('follows', () => true, { status: 'accepted' });
    db.close();
    const reloaded = createDb({ file });
    expect(reloaded.all('users')).toEqual([{ id: '1', name: 'z!', flag: true }]);
    expect(reloaded.all('follows')).toEqual([{ followerId: 'a', followeeId: 'b', status: 'accepted' }]);
    expect(reloaded.all('stories')).toEqual([]);
    // Updates after reload still hit the right row.
    reloaded.update('users', (u) => u.id === '1', { name: 'again' });
    reloaded.close();
    expect(createDb({ file }).all('users')[0].name).toBe('again');
  });

  it('reset and load replace everything', () => {
    const file = tmpFile(name);
    const db = createDb({ file });
    db.insert('users', { id: '1' });
    db.reset();
    expect(db.isEmpty()).toBe(true);
    db.load({ users: [{ id: 'x' }], stories: [{ id: 's' }] });
    db.close();
    const reloaded = createDb({ file });
    expect(reloaded.all('users')).toEqual([{ id: 'x' }]);
    expect(reloaded.all('stories')).toEqual([{ id: 's' }]);
  });
});

describe('migrateJsonToSqlite', () => {
  it('moves legacy JSON data into an empty SQLite db once', () => {
    const json = tmpFile('db.json');
    fs.writeFileSync(json, JSON.stringify({ users: [{ id: 'old' }], follows: [{ followerId: 'a' }] }));
    const db = createDb({ file: path.join(path.dirname(json), 'storytime.sqlite') });
    expect(migrateJsonToSqlite(json, db)).toBe(true);
    expect(db.all('users')).toEqual([{ id: 'old' }]);
    expect(fs.existsSync(json)).toBe(false);
    expect(fs.existsSync(`${json}.migrated`)).toBe(true);
    expect(migrateJsonToSqlite(json, db)).toBe(false);
  });

  it('never overwrites a database that already has users', () => {
    const json = tmpFile('db.json');
    fs.writeFileSync(json, JSON.stringify({ users: [{ id: 'old' }] }));
    const db = createDb();
    db.insert('users', { id: 'current' });
    expect(migrateJsonToSqlite(json, db)).toBe(false);
    expect(db.all('users')).toEqual([{ id: 'current' }]);
  });
});
