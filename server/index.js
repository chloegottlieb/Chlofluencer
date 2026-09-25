import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb, migrateJsonToSqlite } from './db.js';
import { seedDemoData, DEMO_PASSWORD } from './seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig(process.env, { root });

const db = createDb({ file: config.dbFile });
if (migrateJsonToSqlite(config.legacyJsonFile, db)) {
  console.log(`Migrated ${config.legacyJsonFile} to ${config.dbFile}`);
}
if (db.isEmpty() && config.seed) {
  seedDemoData(db, { uploadDir: config.uploadDir });
  console.log(`Seeded demo data. Log in as "demo" / "${DEMO_PASSWORD}" (moderator: "mod")`);
}

const app = createApp({
  db,
  secret: config.jwtSecret,
  uploadDir: config.uploadDir,
  clientDir: config.clientDir,
  corsOrigins: config.corsOrigins,
  rateLimits: config.rateLimits,
  trustProxy: config.trustProxy,
  isProd: config.isProd,
  moderators: config.moderators,
  supportEmail: config.supportEmail,
});

const server = app.listen(config.port, () =>
  console.log(`Storytime ${config.isProd ? '(production) ' : ''}listening on http://localhost:${config.port}`),
);

// Finish in-flight requests and close the database cleanly on deploys/restarts.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
