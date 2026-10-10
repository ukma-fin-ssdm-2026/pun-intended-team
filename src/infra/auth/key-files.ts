// Written with the help of Claude
import { readFileSync } from 'node:fs';

const MIN_KEY_BYTES = 32;

/** Read at startup: a missing or short key stops the server instead of weakening it. */
export function loadCodeHmacKey(): Buffer {
  const key = Buffer.from(readKeyFile('CODE_HMAC_KEY_FILE').trim(), 'base64url');
  if (key.length < MIN_KEY_BYTES) {
    throw new Error(`CODE_HMAC_KEY_FILE: the key must be at least ${MIN_KEY_BYTES} bytes`);
  }
  return key;
}

function readKeyFile(variable: string): string {
  const file = process.env[variable];
  if (!file) {
    throw new Error(`${variable} is not set: run npm run keys:generate and see .env.example`);
  }
  try {
    return readFileSync(file, 'utf8');
  } catch (cause) {
    throw new Error(`${variable}: cannot read ${file}`, { cause });
  }
}
