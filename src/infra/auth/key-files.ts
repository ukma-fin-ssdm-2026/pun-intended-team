// Written with the help of Claude
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const MIN_KEY_BYTES = 32;

export interface SigningKey {
  kid: string;
  secret: Uint8Array;
}

// A JWK Set of HS256 keys. The first key signs; every key verifies, so a new key
// can be put first while tokens signed with the old one are still valid.
const JwkSet = z.object({
  keys: z
    .array(z.object({ kty: z.literal('oct'), alg: z.literal('HS256'), kid: z.string().min(1), k: z.base64url() }))
    .min(1),
});

/** Read at startup: a missing or short key stops the server instead of weakening it. */
export function loadCodeHmacKey(): Buffer {
  const key = Buffer.from(readKeyFile('CODE_HMAC_KEY_FILE').trim(), 'base64url');
  if (key.length < MIN_KEY_BYTES) {
    throw new Error(`CODE_HMAC_KEY_FILE: the key must be at least ${MIN_KEY_BYTES} bytes`);
  }
  return key;
}

/** Read at startup, like the HMAC key; the first key signs. */
export function loadSigningKeys(): SigningKey[] {
  const text = readKeyFile('JWT_KEYS_FILE');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Without the cause: its message quotes the file around the error, which can be key material.
    throw new Error('JWT_KEYS_FILE: the file is not valid JSON');
  }
  const parsed = JwkSet.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      'JWT_KEYS_FILE: expected a JWK Set of HS256 keys: {"keys":[{"kty":"oct","alg":"HS256","kid","k"}]}',
    );
  }
  const keys = parsed.data.keys.map(({ kid, k }) => ({ kid, secret: Buffer.from(k, 'base64url') }));
  for (const { kid, secret } of keys) {
    if (secret.length < MIN_KEY_BYTES) {
      throw new Error(`JWT_KEYS_FILE: key "${kid}" must be at least ${MIN_KEY_BYTES} bytes`);
    }
  }
  if (new Set(keys.map(({ kid }) => kid)).size !== keys.length) {
    throw new Error('JWT_KEYS_FILE: every key needs its own kid');
  }
  return keys;
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
