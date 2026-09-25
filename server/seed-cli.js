import path from 'node:path';
import { createDb } from './db.js';
import { seedDemoData, DEMO_PASSWORD } from './seed.js';

// Wipes the database and rebuilds the demo world. Never run against production.
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
const file = path.join(dataDir, 'storytime.sqlite');
const db = createDb({ file });
db.reset();
seedDemoData(db, { uploadDir: path.join(dataDir, 'uploads') });
console.log(`Seeded ${db.all('users').length} users and ${db.all('stories').length} stories into ${file}`);
console.log(`Log in as "demo" / "${DEMO_PASSWORD}" (moderator: "mod" / "${DEMO_PASSWORD}")`);
db.close();
