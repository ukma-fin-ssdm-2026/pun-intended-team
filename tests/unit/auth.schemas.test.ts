// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GoogleIdTokenBody, RefreshSessionBody } from '../../dist/api/identity/schemas/auth.js';
import { rejectedPaths } from './fixtures/schemas.ts';

const GOOGLE_ID_TOKEN_MAX = 4096;
const REFRESH_TOKEN_MAX = 256;

describe('GoogleIdTokenBody', () => {
  const accepted = [
    { label: 'a token of 1 character', idToken: 'a' },
    { label: `a token of ${GOOGLE_ID_TOKEN_MAX} characters`, idToken: 'a'.repeat(GOOGLE_ID_TOKEN_MAX) },
  ];

  for (const { label, idToken } of accepted) {
    test(`accepts ${label}`, () => {
      const body = { idToken };

      const result = GoogleIdTokenBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  const rejected = [
    { label: 'an empty token', idToken: '' },
    { label: `a token of ${GOOGLE_ID_TOKEN_MAX + 1} characters`, idToken: 'a'.repeat(GOOGLE_ID_TOKEN_MAX + 1) },
  ];

  for (const { label, idToken } of rejected) {
    test(`rejects ${label} and points at idToken`, () => {
      const result = GoogleIdTokenBody.safeParse({ idToken });

      assert.deepEqual(rejectedPaths(result), [['idToken']]);
    });
  }
});

describe('RefreshSessionBody', () => {
  const accepted = [
    { label: 'a token of 1 character', refreshToken: 'a' },
    { label: `a token of ${REFRESH_TOKEN_MAX} characters`, refreshToken: 'a'.repeat(REFRESH_TOKEN_MAX) },
  ];

  for (const { label, refreshToken } of accepted) {
    test(`accepts ${label}`, () => {
      const body = { refreshToken };

      const result = RefreshSessionBody.safeParse(body);

      assert.equal(result.success, true);
      assert.deepEqual(result.data, body);
    });
  }

  const rejected = [
    { label: 'an empty token', refreshToken: '' },
    { label: `a token of ${REFRESH_TOKEN_MAX + 1} characters`, refreshToken: 'a'.repeat(REFRESH_TOKEN_MAX + 1) },
  ];

  for (const { label, refreshToken } of rejected) {
    test(`rejects ${label} and points at refreshToken`, () => {
      const result = RefreshSessionBody.safeParse({ refreshToken });

      assert.deepEqual(rejectedPaths(result), [['refreshToken']]);
    });
  }
});
