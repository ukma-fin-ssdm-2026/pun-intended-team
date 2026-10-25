// Written with the help of Claude
import assert from 'node:assert/strict';
import { argon2Sync } from 'node:crypto';
import { describe, test } from 'node:test';
import { Argon2PasswordHasher } from '../../dist/infra/auth/argon2-password-hasher.js';

const PASSWORD = 'correct-horse';
const hasher = new Argon2PasswordHasher();

function base64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}

describe('Argon2PasswordHasher', () => {
  // SEC-002: argon2id at the OWASP minimum (19 MiB, 2 passes, 1 lane) with a 16-byte salt, in the PHC format.
  test('hashes with argon2id at the OWASP parameters', async () => {
    const hash = await hasher.hash(PASSWORD);

    assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  });

  // SEC-002: a unique salt per hash.
  test('hashes the same password differently each time', async () => {
    assert.notEqual(await hasher.hash(PASSWORD), await hasher.hash(PASSWORD));
  });

  test('verifies the password it hashed', async () => {
    const hash = await hasher.hash(PASSWORD);

    assert.equal(await hasher.verify(hash, PASSWORD), true);
  });

  test('does not verify another password', async () => {
    const hash = await hasher.hash(PASSWORD);

    assert.equal(await hasher.verify(hash, 'wrong-horse'), false);
  });

  test('verifies the same password typed with other Unicode code points', async () => {
    const hash = await hasher.hash('café');

    assert.equal(await hasher.verify(hash, 'café'), true);
  });

  test('verifies a hash made with other parameters, so raising them keeps old passwords working', async () => {
    const salt = Buffer.alloc(16, 1);
    const key = argon2Sync('argon2id', {
      message: PASSWORD,
      nonce: salt,
      tagLength: 32,
      memory: 19456,
      passes: 3,
      parallelism: 1,
    });
    const hash = `$argon2id$v=19$m=19456,t=3,p=1$${base64(salt)}$${base64(key)}`;

    assert.equal(await hasher.verify(hash, PASSWORD), true);
  });

  test('answers false to a stored value that is not an argon2id hash', async () => {
    assert.equal(await hasher.verify('$2b$10$abcdefghijklmnopqrstuv', PASSWORD), false);
  });
});
