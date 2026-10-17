// Written with the help of Claude
import assert from 'node:assert/strict';
import { afterEach, describe, mock, test } from 'node:test';
// Node runs this file as it is, but AuthService needs compiling (decorators), so the code under test
// comes from dist/ (built by `npm run test:unit`); the types come from src/ and are erased.
import { DomainError } from '../../dist/core/common/domain-error.js';
import { AuthService } from '../../dist/core/identity/services/auth.service.js';
import type { NotificationsService } from '../../src/core/notifications/services/notifications.service.ts';
import type { AccessTokens } from '../../src/core/identity/adapters/access-tokens.ts';
import type { AccountsRepository } from '../../src/core/identity/repositories/accounts.repository.ts';
import type { PasswordCredential } from '../../src/core/identity/types/account.ts';
import type { VerificationCode, VerificationCodeRecord } from '../../src/core/identity/types/verification-code.ts';

const PHONE = '+380501234567';
const PASSWORD = 'correct-horse';
const REGISTRATION_START = new Date('2026-10-13T10:00:00Z');
const CODE_LIFETIME_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const adminCredential: PasswordCredential = {
  accountId: 'a0c2e4f6-8b1d-4a3c-9e5f-7b9d1f3a5c6e',
  role: 'admin',
  status: 'active',
  passwordHash: 'stored-hash',
};

/** Every port of AuthService as a mock; a test changes only what it needs. */
function makeService() {
  const accounts = {
    existsByPhone: mock.fn(() => Promise.resolve(false)),
    findPasswordCredential: mock.fn((): Promise<PasswordCredential | undefined> => Promise.resolve(undefined)),
    create: mock.fn(),
    findDateOfBirth: mock.fn(),
  };
  const verificationCodes = {
    findLatest: mock.fn((): Promise<VerificationCode | undefined> => Promise.resolve(undefined)),
    create: mock.fn((record: VerificationCodeRecord): Promise<VerificationCode> =>
      Promise.resolve({ ...record, id: 'code-1', failedAttempts: 0, usedAt: null }),
    ),
    addFailedAttempt: mock.fn(() => Promise.resolve(1)),
    markUsed: mock.fn(() => Promise.resolve(true)),
  };
  const passwordHasher = {
    hash: mock.fn((password: string) => Promise.resolve(`hash(${password})`)),
    verify: mock.fn(() => Promise.resolve(true)),
  };
  const codeHasher = {
    hash: mock.fn((phone: string, code: string) => `${phone}:${code}`),
    matches: mock.fn((phone: string, code: string, hash: string) => hash === `${phone}:${code}`),
  };
  const accessTokens = {
    issue: mock.fn(() => Promise.resolve('signed-token')),
    verify: mock.fn(),
  };
  const notifications = { sendCode: mock.fn(() => Promise.resolve()) };

  const service = new AuthService(
    accounts as unknown as AccountsRepository,
    verificationCodes,
    passwordHasher,
    codeHasher,
    accessTokens as unknown as AccessTokens,
    notifications as unknown as NotificationsService,
  );
  return { service, accounts, verificationCodes, accessTokens, notifications };
}

void describe('AuthService', () => {
  afterEach(() => mock.timers.reset());

  void test('rejects a verification code issued more than 10 minutes ago', async () => {
    mock.timers.enable({ apis: ['Date'], now: REGISTRATION_START });
    const { service, accounts, verificationCodes, notifications } = makeService();

    await service.register(PHONE);
    const [, sentCode] = notifications.sendCode.mock.calls[0]?.arguments as unknown as [string, string];
    // The repository hands back the row it stored, as a real one would.
    const stored = await verificationCodes.create.mock.calls[0]?.result;
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(stored));

    mock.timers.tick(CODE_LIFETIME_MS + 1000);

    await assert.rejects(
      service.verify({ phone: PHONE, code: sentCode, password: PASSWORD, dateOfBirth: '2000-01-01' }),
      (error) => error instanceof DomainError && error.code === 'INVALID_CODE',
    );
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  void test('sign-in asks for a token with the account role and a new session id', async () => {
    const { service, accounts, accessTokens } = makeService();
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(adminCredential));

    const token = await service.signIn(PHONE, PASSWORD);

    assert.equal(accessTokens.issue.mock.callCount(), 1);
    const [caller, lifetimeSeconds] = accessTokens.issue.mock.calls[0]?.arguments as unknown as [
      Record<string, unknown>,
      number,
    ];
    assert.deepEqual(
      { ...caller, sessionId: undefined },
      {
        kind: 'account',
        accountId: adminCredential.accountId,
        role: 'admin',
        sessionId: undefined,
      },
    );
    assert.match(String(caller.sessionId), UUID);
    assert.equal(lifetimeSeconds, 3600);
    assert.deepEqual(token, { accessToken: 'signed-token', expiresIn: 3600 });
  });
});
