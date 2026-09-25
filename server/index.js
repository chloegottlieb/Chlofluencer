import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db.js';
import { seedDemoData, DEMO_PASSWORD } from './seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(root, 'data'));
const uploadDir = path.join(dataDir, 'uploads');
const port = Number(process.env.PORT ?? 4000);

const db = createDb({ file: path.join(dataDir, 'db.json') });
if (db.isEmpty() && process.env.SEED !== 'false') {
  seedDemoData(db, { uploadDir });
  console.log(`Seeded demo data. Log in as "demo" / "${DEMO_PASSWORD}"`);
}

const app = createApp({ db, uploadDir, clientDir: path.join(root, 'dist') });
app.listen(port, () => console.log(`Chlofluencer API listening on http://localhost:${port}`));
