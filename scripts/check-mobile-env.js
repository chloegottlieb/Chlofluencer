// Stops a mobile build that would ship pointing at a placeholder or local API.
import fs from 'node:fs';

const file = '.env.mobile';
const env = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const url = process.env.VITE_API_URL ?? env.match(/^VITE_API_URL=(.*)$/m)?.[1]?.trim();

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n  Set VITE_API_URL in ${file} to your deployed backend, e.g. https://storytime-app.fly.dev\n`);
  process.exit(1);
};

if (!url) fail('VITE_API_URL is not set.');
if (url.includes('YOUR-APP-NAME')) fail(`VITE_API_URL is still the placeholder (${url}).`);
if (!/^https:\/\//.test(url) && !process.env.ALLOW_HTTP_API) {
  fail(`VITE_API_URL must use https:// (got ${url}). App stores require secure connections.`);
}
console.log(`✔ Mobile build will use API ${url}`);
