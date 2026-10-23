// Written with the help of Claude
// Creates the local key files the API reads (npm run keys:generate). Existing files are kept.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const keys = [
  { file: 'keys/code-hmac.key', content: randomKey },
  { file: 'keys/contact-hmac.key', content: randomKey },
  { file: 'keys/data-encryption.key', content: randomKey },
  { file: 'keys/jwt-keys.json', content: () => `${JSON.stringify({ keys: [jwtKey()] }, null, 2)}\n` },
];

function randomKey() {
  return `${randomBytes(32).toString('base64url')}\n`;
}

// The kid is the creation date, so during a rotation it is clear which key is newer.
function jwtKey() {
  const kid = new Date().toISOString().slice(0, 10);
  return { kty: 'oct', alg: 'HS256', kid, k: randomBytes(32).toString('base64url') };
}

mkdirSync('keys', { recursive: true });
for (const { file, content } of keys) {
  try {
    writeFileSync(file, content(), { flag: 'wx', mode: 0o600 });
    console.log(`Created ${file}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
    console.log(`Kept ${file}`);
  }
}
