import path from 'node:path';
import fs from 'node:fs';

// Consistent snapshot of the live database: `npm run backup` (or on Fly:
// `fly ssh console -C "node server/backup.js"` then `fly sftp get /data/backups/<file>`).
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
const source = path.join(dataDir, 'storytime.sqlite');
const dir = path.join(dataDir, 'backups');
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, `storytime-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
const db = new DatabaseSync(source, { readOnly: true });
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
console.log(`Backed up to ${target}`);
