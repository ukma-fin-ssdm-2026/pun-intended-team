// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ConfirmPasswordResetBody,
  GoogleIdTokenBody,
  RefreshSessionBody,
  RegisterBody,
  SetPasswordBody,
  VerifyBody,
} from '../../dist/api/identity/schemas/auth.js';
import { PHONE } from './fixtures/accounts.ts';
import { rejectedPaths } from './fixtures/schemas.ts';

const CODE = '123456';
// SEC-006: the ASVS v5 minimum; the maximum keeps hashing cheap to refuse.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const GOOGLE_ID_TOKEN_MAX = 4096;
const REFRESH_TOKEN_MAX = 256;

// FR-005
describe('RegisterBody', () => {
  test('accepts a number in the +380XXXXXXXXX format', () => {
    const body = { phone: PHONE };

    const result = RegisterBody.safeParse(body);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, body);
  });

  const rejected = [
    { label: 'a number with 8 digits after +380', phone: '+38050123456' },
    { label: 'a number with 10 digits after +380', phone: '+3805012345678' },
    { label: 'a number without the plus', phone: '380501234567' },
    { label: 'a number with another country code', phone: '+381501234567' },
    { label: 'a number with a leading space', phone: ` ${PHONE}` },
  ];

  for (const { label, phone } of rejected) {
    test(`rejects ${label} and points at phone`, () => {
      const result = RegisterBody.safeParse({ phone });

      assert.deepEqual(rejectedPaths(result), [['phone']]);
    });
  }
});

// FR-005, SEC-008
describe('VerifyBody', () => {
  test('accepts a six-digit code', () => {
    const body = { phone: PHONE, code: CODE };

    const result = VerifyBody.safeParse(body);

    assert.equal(result.success, true);
    assert.deepEqual(result.data, body);
  });

  const rejected = [
    { label: 'a five-digit code', code: '12345' },
    { label: 'a seven-digit code', code: '1234567' },
    { label: 'a code with a letter', code: '12345a' },
  ];

  for (const { label, code } of rejected) {
    test(`rejects ${label} and points at code`, () => {
      const result = VerifyBody.safeParse({ phone: PHONE, code });

      assert.deepEqual(rejectedPaths(result), [['code']]);
    });
  }
});

// SEC-006
const newPasswordBodies = [
  { name: 'SetPasswordBody', schema: SetPasswordBody, build: (password: string) => ({ password }) },
  {
    name: 'ConfirmPasswordResetBody',
    schema: ConfirmPasswordResetBody,
    build: (password: string) => ({ phone: PHONE, code: CODE, password }),
  },
];

for (const { name, schema, build } of newPasswordBodies) {
  describe(name, () => {
    const accepted = [
      { label: `a password of ${PASSWORD_MIN} characters`, password: 'a'.repeat(PASSWORD_MIN) },
      { label: `a password of ${PASSWORD_MAX} characters`, password: 'a'.repeat(PASSWORD_MAX) },
      // Passwords are not trimmed on purpose: OWASP allows any character, spaces included.
      { label: `a password of ${PASSWORD_MIN} spaces`, password: ' '.repeat(PASSWORD_MIN) },
    ];

    for (const { label, password } of accepted) {
      test(`accepts ${label}`, () => {
        const body = build(password);

        const result = schema.safeParse(body);

        assert.equal(result.success, true);
        assert.deepEqual(result.data, body);
      });
    }

    const rejected = [
      { label: `a password of ${PASSWORD_MIN - 1} characters`, password: 'a'.repeat(PASSWORD_MIN - 1) },
      { label: `a password of ${PASSWORD_MAX + 1} characters`, password: 'a'.repeat(PASSWORD_MAX + 1) },
    ];

    for (const { label, password } of rejected) {
      test(`rejects ${label} and points at password`, () => {
        const result = schema.safeParse(build(password));

        assert.deepEqual(rejectedPaths(result), [['password']]);
      });
    }
  });
}

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
