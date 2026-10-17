// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { AuthService } from '../../dist/core/identity/services/auth.service.js';
import type { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { AccessTokens } from '../../dist/core/identity/adapters/access-tokens.js';
import type { AccountsRepository } from '../../dist/core/identity/repositories/accounts.repository.js';
import type { Account, AccountRecord, PasswordCredential } from '../../dist/core/identity/types/account.js';
import type { Registration } from '../../dist/core/identity/types/auth.js';
import type { VerificationCode, VerificationCodeRecord } from '../../dist/core/identity/types/verification-code.js';
import { ACCOUNT_ID, PHONE } from './fixtures/accounts.ts';
import { NOW, useFixedClock } from './fixtures/clock.ts';

const CODE = '123456';
const PASSWORD = 'correct-horse';
const SIGNED_TOKEN = 'signed-token';
const ACCESS_TOKEN_SECONDS = 60 * 60; // SEC-005
const CODE_LIFETIME_MS = 10 * 60 * 1000; // SEC-008
const CODE_RESEND_INTERVAL_MS = 60 * 1000; // SEC-008
const MAX_FAILED_ATTEMPTS = 3; // SEC-008
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function aCredential(overrides: Partial<PasswordCredential> = {}): PasswordCredential {
  return { accountId: ACCOUNT_ID, role: 'user', status: 'active', passwordHash: 'stored-hash', ...overrides };
}

/** The code CODE, sent to PHONE a minute before NOW; it expires CODE_LIFETIME_MS after it was sent. */
function aCode(overrides: Partial<VerificationCode> = {}): VerificationCode {
  const sentAt = overrides.sentAt ?? new Date(NOW.getTime() - 60 * 1000);
  return {
    id: 'code-1',
    phone: PHONE,
    purpose: 'registration',
    codeHash: `${PHONE}:${CODE}`,
    sentAt,
    expiresAt: new Date(sentAt.getTime() + CODE_LIFETIME_MS),
    failedAttempts: 0,
    usedAt: null,
    ...overrides,
  };
}

/** An adult registering PHONE with the right code. */
function aRegistration(overrides: Partial<Registration> = {}): Registration {
  return { phone: PHONE, code: CODE, password: PASSWORD, dateOfBirth: '2006-12-09', ...overrides };
}

/** Every port of AuthService as a mock; a test changes only what it needs. */
function makeService() {
  const accounts = {
    existsByPhone: mock.fn(() => Promise.resolve(false)),
    findPasswordCredential: mock.fn((): Promise<PasswordCredential | undefined> => Promise.resolve(undefined)),
    create: mock.fn((record: AccountRecord): Promise<Account> => Promise.resolve({ id: ACCOUNT_ID, ...record })),
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
  return { service, accounts, verificationCodes, passwordHasher, accessTokens, notifications };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('AuthService.register', () => {
  useFixedClock();

  test('stores the code hashed with a 10-minute lifetime and sends the same code', async () => {
    const { service, verificationCodes, notifications } = makeService();

    await service.register(PHONE);

    const [phone, sentCode] = notifications.sendCode.mock.calls[0]?.arguments as unknown as [string, string];
    assert.equal(phone, PHONE);
    assert.match(sentCode, /^\d{6}$/);
    assert.deepEqual(verificationCodes.create.mock.calls[0]?.arguments, [
      {
        phone: PHONE,
        purpose: 'registration',
        codeHash: `${PHONE}:${sentCode}`,
        sentAt: NOW,
        expiresAt: new Date(NOW.getTime() + CODE_LIFETIME_MS),
      },
    ]);
  });

  test('refuses a new code less than a minute after the last one', async () => {
    const { service, verificationCodes, notifications } = makeService();
    const sentAt = new Date(NOW.getTime() - CODE_RESEND_INTERVAL_MS + 1);
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ sentAt })));

    const registering = service.register(PHONE);

    await assert.rejects(registering, isDomainError('CODE_RESEND_TOO_SOON'));
    assert.equal(verificationCodes.create.mock.callCount(), 0);
    assert.equal(notifications.sendCode.mock.callCount(), 0);
  });

  test('sends a new code exactly a minute after the last one', async () => {
    const { service, verificationCodes, notifications } = makeService();
    const sentAt = new Date(NOW.getTime() - CODE_RESEND_INTERVAL_MS);
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ sentAt })));

    await service.register(PHONE);

    assert.equal(notifications.sendCode.mock.callCount(), 1);
  });
});

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

    const verifying = service.verify(aRegistration({ code: sentCode }));

    await assert.rejects(verifying, isDomainError('INVALID_CODE'));
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  test('rejects a code at the very moment it expires', async () => {
    const { service, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ expiresAt: NOW })));

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
  });

  test('rejects a phone that was never sent a code', async () => {
    const { service, accounts } = makeService();

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  test('rejects a code that was already used', async () => {
    const { service, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ usedAt: NOW })));

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
  });

  test('counts a wrong code as a failed attempt', async () => {
    const { service, verificationCodes } = makeService();
    const code = aCode();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(code));

    const verifying = service.verify(aRegistration({ code: '000000' }));

    await assert.rejects(verifying, isDomainError('INVALID_CODE'));
    assert.deepEqual(verificationCodes.addFailedAttempt.mock.calls[0]?.arguments, [code.id]);
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
  });

  test('accepts the right code after 2 failed attempts', async () => {
    const { service, verificationCodes, accounts } = makeService();
    const failedAttempts = MAX_FAILED_ATTEMPTS - 1;
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ failedAttempts })));

    await service.verify(aRegistration());

    assert.equal(accounts.create.mock.callCount(), 1);
  });

  test('rejects even the right code after 3 failed attempts, without counting another', async () => {
    const { service, verificationCodes } = makeService();
    const failedAttempts = MAX_FAILED_ATTEMPTS;
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ failedAttempts })));

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
    assert.equal(verificationCodes.addFailedAttempt.mock.callCount(), 0);
  });

  test('rejects the code when a parallel request used it first', async () => {
    const { service, accounts, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    verificationCodes.markUsed.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  test('uses up the code even when the age check fails', async () => {
    const { service, accounts, verificationCodes } = makeService();
    const code = aCode();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(code));

    const verifying = service.verify(aRegistration({ dateOfBirth: '2010-01-01' }));

    await assert.rejects(verifying, isDomainError('UNDERAGE'));
    assert.deepEqual(verificationCodes.markUsed.mock.calls[0]?.arguments, [code.id, NOW]);
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  // SAFE-001: the age changes at midnight in Kyiv; a 29 February birthday counts from 1 March.
  const ageCases = [
    {
      now: '2026-10-15T09:00:00Z',
      dateOfBirth: '2008-10-15',
      adult: true,
      title: 'accepts someone who turns 18 today',
    },
    {
      now: '2026-10-15T09:00:00Z',
      dateOfBirth: '2008-10-16',
      adult: false,
      title: 'refuses someone who turns 18 tomorrow',
    },
    {
      now: '2026-10-14T21:30:00Z',
      dateOfBirth: '2008-10-15',
      adult: true,
      title: 'accepts an 18th birthday that has begun in Kyiv but not yet in UTC',
    },
    {
      now: '2026-10-14T20:30:00Z',
      dateOfBirth: '2008-10-15',
      adult: false,
      title: 'refuses an 18th birthday an hour before Kyiv midnight',
    },
    {
      now: '2026-02-28T09:00:00Z',
      dateOfBirth: '2008-02-29',
      adult: false,
      title: 'refuses a 29 February birthday on 28 February',
    },
    {
      now: '2026-03-01T09:00:00Z',
      dateOfBirth: '2008-02-29',
      adult: true,
      title: 'accepts a 29 February birthday on 1 March',
    },
  ];

  for (const { now, dateOfBirth, adult, title } of ageCases) {
    test(title, async () => {
      mock.timers.setTime(Date.parse(now));
      const { service, verificationCodes } = makeService();
      const code = aCode({ sentAt: new Date(now) });
      verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(code));

      const verifying = service.verify(aRegistration({ dateOfBirth }));

      if (adult) {
        await verifying;
      } else {
        await assert.rejects(verifying, isDomainError('UNDERAGE'));
      }
    });
  }

  test('rejects a phone that already has an account', async () => {
    const { service, accounts, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    accounts.existsByPhone.mock.mockImplementation(() => Promise.resolve(true));

    await assert.rejects(service.verify(aRegistration()), isDomainError('CONFLICT'));
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  test('creates an active user account with the hashed password and signs it in', async () => {
    const { service, accounts, verificationCodes, accessTokens } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    const registration = aRegistration();

    const token = await service.verify(registration);

    assert.deepEqual(accounts.create.mock.calls[0]?.arguments, [
      { phone: registration.phone, role: 'user', status: 'active', dateOfBirth: registration.dateOfBirth },
      `hash(${registration.password})`,
    ]);
    const [caller] = accessTokens.issue.mock.calls[0]?.arguments as unknown as [Record<string, unknown>];
    assert.equal(caller.accountId, ACCOUNT_ID);
    assert.deepEqual(token, { accessToken: SIGNED_TOKEN, expiresIn: ACCESS_TOKEN_SECONDS });
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

  // SEC-007: an unknown phone costs a hash check too, so the response time does not reveal it.
  test('checks the password of an unknown phone against one stand-in hash', async () => {
    const { service, passwordHasher } = makeService();

    await assert.rejects(service.signIn(PHONE, PASSWORD), isDomainError('INVALID_CREDENTIALS'));
    await assert.rejects(service.signIn('+380501234500', PASSWORD), isDomainError('INVALID_CREDENTIALS'));

    assert.equal(passwordHasher.hash.mock.callCount(), 1);
    const standIn = await passwordHasher.hash.mock.calls[0]?.result;
    assert.deepEqual(
      passwordHasher.verify.mock.calls.map((call) => call.arguments),
      [
        [standIn, PASSWORD],
        [standIn, PASSWORD],
      ],
    );
  });

  test('rejects a wrong password', async () => {
    const { service, accounts, passwordHasher, accessTokens } = makeService();
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential()));
    passwordHasher.verify.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.signIn(PHONE, 'wrong-password'), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(accessTokens.issue.mock.callCount(), 0);
  });

  test('rejects a banned account even with the right password', async () => {
    const { service, accounts, accessTokens } = makeService();
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential({ status: 'banned' })));

    await assert.rejects(service.signIn(PHONE, PASSWORD), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(accessTokens.issue.mock.callCount(), 0);
  });
});

describe('AuthService.issueGuestToken', () => {
  test('asks for a token for a guest with a new id', async () => {
    const { service, accessTokens } = makeService();

    const token = await service.issueGuestToken();

    const [caller, lifetimeSeconds] = accessTokens.issue.mock.calls[0]?.arguments as unknown as [
      Record<string, unknown>,
      number,
    ];
    assert.equal(caller.kind, 'guest');
    assert.match(String(caller.guestId), UUID);
    assert.equal(lifetimeSeconds, ACCESS_TOKEN_SECONDS);
    assert.deepEqual(token, { accessToken: SIGNED_TOKEN, expiresIn: ACCESS_TOKEN_SECONDS });
  });
});
