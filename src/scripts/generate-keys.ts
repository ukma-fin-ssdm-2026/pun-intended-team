// Written with the help of Claude
// Creates the local key files the API reads (npm run keys:generate). Existing files are kept.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const keys = [{ file: 'keys/code-hmac.key', content: () => `${randomBytes(32).toString('base64url')}\n` }];

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
