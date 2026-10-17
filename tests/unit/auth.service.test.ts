// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { AuthService } from '../../dist/core/identity/services/auth.service.js';
import type { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { AccessTokens } from '../../dist/core/identity/adapters/access-tokens.js';
import type { AccountsRepository } from '../../dist/core/identity/repositories/accounts.repository.js';
import type { PasswordCredential } from '../../dist/core/identity/types/account.js';
import type { VerificationCode, VerificationCodeRecord } from '../../dist/core/identity/types/verification-code.js';
import { ACCOUNT_ID, PHONE } from './fixtures/accounts.ts';
import { useFixedClock } from './fixtures/clock.ts';

const PASSWORD = 'correct-horse';
const SIGNED_TOKEN = 'signed-token';
const ACCESS_TOKEN_SECONDS = 60 * 60; // SEC-005
const CODE_LIFETIME_MS = 10 * 60 * 1000; // SEC-008
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function aCredential(overrides: Partial<PasswordCredential> = {}): PasswordCredential {
  return { accountId: ACCOUNT_ID, role: 'user', status: 'active', passwordHash: 'stored-hash', ...overrides };
}

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
    issue: mock.fn(() => Promise.resolve(SIGNED_TOKEN)),
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

describe('AuthService.verify', () => {
  useFixedClock();

  test('rejects a verification code issued more than 10 minutes ago', async () => {
    const { service, accounts, verificationCodes, notifications } = makeService();
    await service.register(PHONE);
    const [, sentCode] = notifications.sendCode.mock.calls[0]?.arguments as unknown as [string, string];
    // The repository hands back the row it stored, as a real one would.
    const stored = await verificationCodes.create.mock.calls[0]?.result;
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(stored));
    mock.timers.tick(CODE_LIFETIME_MS + 1000);

    const verifying = service.verify({ phone: PHONE, code: sentCode, password: PASSWORD, dateOfBirth: '2000-01-01' });

    await assert.rejects(verifying, (error) => error instanceof DomainError && error.code === 'INVALID_CODE');
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
    assert.equal(accounts.create.mock.callCount(), 0);
  });
});

describe('AuthService.signIn', () => {
  test('asks for a token with the account role and a new session id', async () => {
    const { service, accounts, accessTokens } = makeService();
    // Not the default role, so a service that ignored the credential's role would fail.
    const credential = aCredential({ role: 'admin' });
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(credential));

    const token = await service.signIn(PHONE, PASSWORD);

    assert.equal(accessTokens.issue.mock.callCount(), 1);
    const [caller, lifetimeSeconds] = accessTokens.issue.mock.calls[0]?.arguments as unknown as [
      Record<string, unknown>,
      number,
    ];
    const { sessionId, ...account } = caller;
    assert.deepEqual(account, { kind: 'account', accountId: credential.accountId, role: credential.role });
    assert.match(String(sessionId), UUID);
    assert.equal(lifetimeSeconds, ACCESS_TOKEN_SECONDS);
    assert.deepEqual(token, { accessToken: SIGNED_TOKEN, expiresIn: ACCESS_TOKEN_SECONDS });
  });
});
