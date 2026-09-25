import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTIONS, createDb } from '../../server/db.js';

const tmpFiles = [];
const tmpFile = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-db-'));
  tmpFiles.push(dir);
  return path.join(dir, 'db.json');
};
afterEach(() => {
  for (const d of tmpFiles.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('createDb', () => {
  it('starts with every collection empty', () => {
    const db = createDb();
    for (const c of COLLECTIONS) expect(db.all(c)).toEqual([]);
    expect(db.isEmpty()).toBe(true);
  });

  it('supports insert / find / filter / update / remove', () => {
    const db = createDb();
    db.insert('users', { id: '1', name: 'a' });
    db.insert('users', { id: '2', name: 'b' });
    expect(db.find('users', (u) => u.id === '2').name).toBe('b');
    expect(db.find('users', (u) => u.id === '3')).toBeNull();
    expect(db.filter('users', (u) => u.id !== '1')).toHaveLength(1);
    expect(db.update('users', (u) => u.id === '1', { name: 'z' }).name).toBe('z');
    expect(db.update('users', (u) => u.id === '1', (u) => ({ name: u.name + '!' })).name).toBe('z!');
    expect(db.update('users', (u) => u.id === 'nope', { name: 'x' })).toBeNull();
    expect(db.remove('users', (u) => u.id === '1')).toBe(1);
    expect(db.all('users')).toHaveLength(1);
    expect(db.isEmpty()).toBe(false);
  });

  it('persists to disk and reloads', () => {
    const file = tmpFile();
    const db = createDb({ file });
    db.insert('users', { id: '1' });
    expect(fs.existsSync(file)).toBe(true);
    const reloaded = createDb({ file });
    expect(reloaded.all('users')).toEqual([{ id: '1' }]);
    expect(reloaded.all('stories')).toEqual([]);
  });

  it('reset clears everything', () => {
    const db = createDb();
    db.insert('users', { id: '1' });
    db.reset();
    expect(db.isEmpty()).toBe(true);
  });
});
