// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PersonalDataCipher } from '../../dist/infra/prisma/personal-data-cipher.js';
import { PHONE } from './fixtures/accounts.ts';

const ENCRYPTION_KEY = Buffer.alloc(32, 7);
const HMAC_KEY = Buffer.alloc(32, 9);
const cipher = new PersonalDataCipher(ENCRYPTION_KEY, HMAC_KEY);

describe('PersonalDataCipher.encrypt', () => {
  test('gives back the text it encrypted', () => {
    assert.equal(cipher.decrypt(cipher.encrypt(PHONE)), PHONE);
  });

  test('does not store the text in the clear', () => {
    assert.equal(Buffer.from(cipher.encrypt(PHONE)).includes(PHONE), false);
  });

  test('gives another value each time, so equal phone numbers do not look equal', () => {
    assert.notDeepEqual(cipher.encrypt(PHONE), cipher.encrypt(PHONE));
  });
});

describe('PersonalDataCipher.decrypt', () => {
  test('refuses a value encrypted with another key', () => {
    const other = new PersonalDataCipher(Buffer.alloc(32, 8), HMAC_KEY);

    assert.throws(() => cipher.decrypt(other.encrypt(PHONE)));
  });

  test('refuses a value changed after it was stored', () => {
    const stored = cipher.encrypt(PHONE);
    stored[stored.length - 1] = (stored[stored.length - 1] ?? 0) ^ 1;

    assert.throws(() => cipher.decrypt(stored));
  });

  test('refuses a value in an unknown format', () => {
    const stored = cipher.encrypt(PHONE);
    stored[0] = 2;

    assert.throws(() => cipher.decrypt(stored), /Unknown encrypted value format 2/);
  });
});

describe('PersonalDataCipher.hash', () => {
  test('gives the same hash for the same phone, so it can be looked up', () => {
    assert.deepEqual(cipher.hash(PHONE), cipher.hash(PHONE));
  });

  test('gives another hash for another phone', () => {
    assert.notDeepEqual(cipher.hash(PHONE), cipher.hash('+380501234500'));
  });

  test('gives another hash with another key', () => {
    const other = new PersonalDataCipher(ENCRYPTION_KEY, Buffer.alloc(32, 8));

    assert.notDeepEqual(other.hash(PHONE), cipher.hash(PHONE));
  });
});
