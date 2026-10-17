// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HmacCodeHasher } from '../../dist/infra/auth/hmac-code-hasher.js';
import { PHONE } from './fixtures/accounts.ts';

const CODE = '123456';
const hasher = new HmacCodeHasher(Buffer.alloc(32, 7));

describe('HmacCodeHasher', () => {
  test('matches the code it hashed for the same phone', () => {
    const hash = hasher.hash(PHONE, CODE);

    assert.equal(hasher.matches(PHONE, CODE, hash), true);
  });

  test('does not match another code', () => {
    const hash = hasher.hash(PHONE, CODE);

    assert.equal(hasher.matches(PHONE, '654321', hash), false);
  });

  test('does not match the same code sent to another phone', () => {
    const hash = hasher.hash(PHONE, CODE);

    assert.equal(hasher.matches('+380501234500', CODE, hash), false);
  });

  test('gives another hash with another key', () => {
    const otherHasher = new HmacCodeHasher(Buffer.alloc(32, 8));

    assert.notEqual(otherHasher.hash(PHONE, CODE), hasher.hash(PHONE, CODE));
  });

  test('answers false to a stored hash of another length instead of throwing', () => {
    assert.equal(hasher.matches(PHONE, CODE, 'too-short'), false);
  });
});
