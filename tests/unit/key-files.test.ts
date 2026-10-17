// Written with the help of Claude
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadCodeHmacKey, loadSigningKeys } from '../../dist/infra/auth/key-files.js';

const KEY = Buffer.alloc(32, 7);
const SHORT_KEY = Buffer.alloc(31, 7);

interface Jwk {
  kty: string;
  alg: string;
  kid: string;
  k: string;
}

function aJwk(overrides: Partial<Jwk> = {}): Jwk {
  return { kty: 'oct', alg: 'HS256', kid: 'key-1', k: KEY.toString('base64url'), ...overrides };
}

let folder: string;

/** Writes `content` to a file in the test folder and points `variable` at it. */
function useKeyFile(variable: string, content: string): void {
  const file = path.join(folder, variable);
  writeFileSync(file, content);
  process.env[variable] = file;
}

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'nearby-keys-'));
  delete process.env.CODE_HMAC_KEY_FILE;
  delete process.env.JWT_KEYS_FILE;
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
  delete process.env.CODE_HMAC_KEY_FILE;
  delete process.env.JWT_KEYS_FILE;
});

describe('loadCodeHmacKey', () => {
  test('reads the key and ignores the newline at the end of the file', () => {
    useKeyFile('CODE_HMAC_KEY_FILE', `${KEY.toString('base64url')}\n`);

    assert.deepEqual(loadCodeHmacKey(), KEY);
  });

  test('refuses a key shorter than 32 bytes', () => {
    useKeyFile('CODE_HMAC_KEY_FILE', SHORT_KEY.toString('base64url'));

    assert.throws(() => loadCodeHmacKey(), /at least 32 bytes/);
  });

  test('stops when the variable is not set, and says how to create the key', () => {
    assert.throws(() => loadCodeHmacKey(), /CODE_HMAC_KEY_FILE is not set: run npm run keys:generate/);
  });

  test('stops when the file cannot be read', () => {
    process.env.CODE_HMAC_KEY_FILE = path.join(folder, 'missing.key');

    assert.throws(() => loadCodeHmacKey(), /CODE_HMAC_KEY_FILE: cannot read/);
  });
});

describe('loadSigningKeys', () => {
  test('reads every key, the signing key first', () => {
    const second = Buffer.alloc(32, 9);
    useKeyFile(
      'JWT_KEYS_FILE',
      JSON.stringify({ keys: [aJwk(), aJwk({ kid: 'key-2', k: second.toString('base64url') })] }),
    );

    assert.deepEqual(loadSigningKeys(), [
      { kid: 'key-1', secret: KEY },
      { kid: 'key-2', secret: second },
    ]);
  });

  test('refuses a file that is not JSON without quoting it, since it may hold key material', () => {
    const secretText = KEY.toString('base64url');
    useKeyFile('JWT_KEYS_FILE', `{"keys":[{"k":"${secretText}"`);

    assert.throws(
      () => loadSigningKeys(),
      (error: Error) => /not valid JSON/.test(error.message) && !error.message.includes(secretText) && !error.cause,
    );
  });

  const invalidSets = [
    { title: 'refuses a key for another algorithm', keys: [aJwk({ alg: 'RS256' })] },
    { title: 'refuses a set without keys', keys: [] },
    { title: 'refuses a key without a kid', keys: [aJwk({ kid: '' })] },
  ];

  for (const { title, keys } of invalidSets) {
    test(title, () => {
      useKeyFile('JWT_KEYS_FILE', JSON.stringify({ keys }));

      assert.throws(() => loadSigningKeys(), /expected a JWK Set of HS256 keys/);
    });
  }

  test('names the key that is shorter than 32 bytes', () => {
    useKeyFile(
      'JWT_KEYS_FILE',
      JSON.stringify({ keys: [aJwk(), aJwk({ kid: 'short', k: SHORT_KEY.toString('base64url') })] }),
    );

    assert.throws(() => loadSigningKeys(), /key "short" must be at least 32 bytes/);
  });

  test('refuses two keys with the same kid', () => {
    useKeyFile('JWT_KEYS_FILE', JSON.stringify({ keys: [aJwk(), aJwk()] }));

    assert.throws(() => loadSigningKeys(), /every key needs its own kid/);
  });
});
