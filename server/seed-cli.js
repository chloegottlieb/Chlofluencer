import path from 'node:path';
import fs from 'node:fs';
import { createDb } from './db.js';
import { seedDemoData, DEMO_PASSWORD } from './seed.js';

const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
const file = path.join(dataDir, 'db.json');
fs.rmSync(file, { force: true });
const db = createDb({ file });
seedDemoData(db, { uploadDir: path.join(dataDir, 'uploads') });
db.persist();
console.log(`Seeded ${db.all('users').length} users and ${db.all('stories').length} stories into ${file}`);
console.log(`Log in as "demo" / "${DEMO_PASSWORD}"`);
