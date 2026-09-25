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
  'reports',
  'moderationActions',
];

function emptyData() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
}

/**
 * Small document store with a synchronous API. All documents are held in
 * memory for fast, simple queries; every write is also persisted:
 *
 *   createDb()                     in-memory only (tests)
 *   createDb({ file: 'x.sqlite' }) SQLite, one row per document (production)
 *   createDb({ file: 'x.json' })   legacy single JSON file
 *
 * Callers must change documents through insert/update/updateMany/remove so
 * the change reaches disk.
 */
export function createDb({ file = null } = {}) {
  if (!file) return memoryDb(emptyData(), {});
  if (file.endsWith('.json')) return jsonDb(file);
  return sqliteDb(file);
}

function memoryDb(initial, backend) {
  let data = initial;
  const noop = () => {};
  const onInsert = backend.onInsert ?? noop;
  const onUpdate = backend.onUpdate ?? noop;
  const onRemove = backend.onRemove ?? noop;
  const transaction = backend.transaction ?? ((fn) => fn());

  const db = {
    get data() {
      return data;
    },
    all: (name) => data[name],
    find: (name, predicate) => data[name].find(predicate) ?? null,
    filter: (name, predicate) => data[name].filter(predicate),
    insert(name, doc) {
      data[name].push(doc);
      onInsert(name, doc);
      return doc;
    },
    update(name, predicate, patch) {
      const doc = data[name].find(predicate);
      if (!doc) return null;
      Object.assign(doc, typeof patch === 'function' ? patch(doc) : patch);
      onUpdate(name, doc);
      return doc;
    },
    updateMany(name, predicate, patch) {
      const docs = data[name].filter(predicate);
      transaction(() => {
        for (const doc of docs) {
          Object.assign(doc, typeof patch === 'function' ? patch(doc) : patch);
          onUpdate(name, doc);
        }
      });
      return docs.length;
    },
    remove(name, predicate) {
      const removed = data[name].filter(predicate);
      if (!removed.length) return 0;
      data[name] = data[name].filter((doc) => !predicate(doc));
      transaction(() => onRemove(name, removed));
      return removed.length;
    },
    isEmpty: () => data.users.length === 0,
    reset() {
      data = emptyData();
      backend.onReset?.();
    },
    /** Replace everything (used for migrations and seeding). */
    load(next) {
      data = { ...emptyData(), ...next };
      backend.onLoad?.(data);
    },
    close: () => backend.close?.(),
  };
  return db;
}

function jsonDb(file) {
  let initial = emptyData();
  if (fs.existsSync(file)) initial = { ...emptyData(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  let db;
  const persist = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(db.data));
    fs.renameSync(`${file}.tmp`, file);
  };
  db = memoryDb(initial, { onInsert: persist, onUpdate: persist, onRemove: persist, onReset: persist, onLoad: persist });
  return db;
}

function sqliteDb(file) {
  // Imported lazily so the rest of the app (and tests) work without node:sqlite.
  const { DatabaseSync } = loadSqlite();
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sql = new DatabaseSync(file);
  sql.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection TEXT NOT NULL,
      doc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS docs_collection ON docs (collection);
  `);
  const rowIds = new WeakMap();
  const insertStmt = sql.prepare('INSERT INTO docs (collection, doc) VALUES (?, ?)');
  const updateStmt = sql.prepare('UPDATE docs SET doc = ? WHERE id = ?');
  const deleteStmt = sql.prepare('DELETE FROM docs WHERE id = ?');

  const data = emptyData();
  for (const row of sql.prepare('SELECT id, collection, doc FROM docs ORDER BY id').all()) {
    const doc = JSON.parse(row.doc);
    (data[row.collection] ??= []).push(doc);
    rowIds.set(doc, row.id);
  }

  let depth = 0;
  const transaction = (fn) => {
    if (depth > 0) return fn();
    depth++;
    sql.exec('BEGIN');
    try {
      const out = fn();
      sql.exec('COMMIT');
      return out;
    } catch (err) {
      sql.exec('ROLLBACK');
      throw err;
    } finally {
      depth--;
    }
  };
  const writeInsert = (name, doc) => rowIds.set(doc, Number(insertStmt.run(name, JSON.stringify(doc)).lastInsertRowid));

  return memoryDb(data, {
    transaction,
    onInsert: writeInsert,
    onUpdate: (_name, doc) => updateStmt.run(JSON.stringify(doc), rowIds.get(doc)),
    onRemove: (_name, docs) => docs.forEach((doc) => deleteStmt.run(rowIds.get(doc))),
    onReset: () => sql.exec('DELETE FROM docs'),
    onLoad: (next) =>
      transaction(() => {
        sql.exec('DELETE FROM docs');
        for (const [name, docs] of Object.entries(next)) docs.forEach((doc) => writeInsert(name, doc));
      }),
    close: () => sql.close(),
  });
}

let sqliteModule;
function loadSqlite() {
  if (!sqliteModule) {
    // node:sqlite is built into Node 22.13+; keep its experimental warning quiet.
    const emit = process.emitWarning;
    process.emitWarning = (warning, ...rest) =>
      String(warning).includes('SQLite') ? undefined : emit.call(process, warning, ...rest);
    try {
      sqliteModule = process.getBuiltinModule('node:sqlite');
    } finally {
      process.emitWarning = emit;
    }
  }
  return sqliteModule;
}

/** One-time move from the old data/db.json to SQLite. Returns true if migrated. */
export function migrateJsonToSqlite(jsonFile, db) {
  if (!fs.existsSync(jsonFile) || !db.isEmpty()) return false;
  const legacy = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  db.load(legacy);
  fs.renameSync(jsonFile, `${jsonFile}.migrated`);
  return true;
}
