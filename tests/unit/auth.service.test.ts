// Written with the help of Claude
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { describe, mock, test } from 'node:test';
import { Logger } from '@nestjs/common';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { AuthService } from '../../dist/core/identity/services/auth.service.js';
import { NO_LOCKOUT } from '../../dist/core/identity/services/sign-in-lockout.js';
import type { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { CodeDelivery } from '../../dist/core/notifications/types/code-delivery.js';
import type { SessionsService } from '../../dist/core/identity/services/sessions.service.js';
import type { AccessTokens } from '../../dist/core/identity/adapters/access-tokens.js';
import type { AccountsRepository } from '../../dist/core/identity/repositories/accounts.repository.js';
import type {
  Account,
  AccountRecord,
  GoogleLinkResult,
  PasswordCredential,
  SignInLockout,
} from '../../dist/core/identity/types/account.js';
import type { PasswordReset, Registration, SessionTokens } from '../../dist/core/identity/types/auth.js';
import type { Caller } from '../../dist/core/identity/types/caller.js';
import type { VerificationCode, VerificationCodeRecord } from '../../dist/core/identity/types/verification-code.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID, PHONE } from './fixtures/accounts.ts';
import { NOW, useFixedClock } from './fixtures/clock.ts';

const CODE = '123456';
const PASSWORD = 'correct-horse';
const SIGNED_TOKEN = 'signed-token';
const SESSION_ID = 'b0000000-0000-4000-8000-000000000001';
const SESSION_TOKENS: SessionTokens = {
  accessToken: SIGNED_TOKEN,
  expiresIn: 60 * 60,
  refreshToken: `${SESSION_ID}.refresh-secret`,
};
const ACCESS_TOKEN_SECONDS = 60 * 60; // SEC-005
const REGISTRATION_TOKEN_SECONDS = 15 * 60;
const ADULT_BIRTH_DATE = '2000-05-17';
const CODE_LIFETIME_MS = 10 * 60 * 1000; // SEC-008
// SEC-008: a phone gets no code within a minute of the last one, and at most 5 a day.
const CODE_SEND_LIMIT = {
  noneSentAfter: new Date(NOW.getTime() - 60 * 1000),
  since: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
  atMost: 5,
};
const MAX_CODE_ATTEMPTS = 3; // SEC-008
const DELIVERY: CodeDelivery = { channel: 'sms', providerRequestId: 'provider-request-1' };
const GOOGLE_ID_TOKEN = 'google-id-token';
const GOOGLE_SUBJECT = '109876543210987654321';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function anAccount(overrides: Partial<Account> = {}): Account {
  return { id: ACCOUNT_ID, phone: PHONE, role: 'user', status: 'active', dateOfBirth: '2001-04-12', ...overrides };
}

/** An account that verified its code but has not passed the age check yet. */
function aPendingAccount(overrides: Partial<Account> = {}): Account {
  return anAccount({ status: 'pending', dateOfBirth: null, ...overrides });
}

/** An account registered with Google that has not passed the age check yet. */
function aGoogleRegistrant(overrides: Partial<Account> = {}): Account {
  return aPendingAccount({ phone: null, ...overrides });
}

function aCredential(overrides: Partial<PasswordCredential> = {}): PasswordCredential {
  return {
    accountId: ACCOUNT_ID,
    role: 'user',
    status: 'active',
    passwordHash: 'stored-hash',
    ...overrides,
  };
}

/** The code CODE, sent to PHONE a minute before NOW; it expires CODE_LIFETIME_MS after it was sent. */
function aCode(overrides: Partial<VerificationCode> = {}): VerificationCode {
  const sentAt = overrides.sentAt ?? new Date(NOW.getTime() - 60 * 1000);
  return {
    id: 'code-1',
    phone: PHONE,
    purpose: 'registration',
    codeHash: `${PHONE}:${CODE}`,
    channel: 'telegram',
    providerRequestId: null,
    sentAt,
    expiresAt: new Date(sentAt.getTime() + CODE_LIFETIME_MS),
    attempts: 0,
    usedAt: null,
    ...overrides,
  };
}

/** An adult registering PHONE with the right code. */
function aRegistration(overrides: Partial<Registration> = {}): Registration {
  return { phone: PHONE, code: CODE, ...overrides };
}

/** PHONE resetting its password with the right code. */
function aPasswordReset(overrides: Partial<PasswordReset> = {}): PasswordReset {
  return { phone: PHONE, code: CODE, password: 'a new long passphrase', ...overrides };
}

/** Every port of AuthService as a mock; a test changes only what it needs. `lockout` is the stored lockout state. */
function makeService({ lockout = NO_LOCKOUT }: { lockout?: SignInLockout } = {}) {
  let storedLockout = lockout;
  const accounts = {
    findById: mock.fn((): Promise<Account | undefined> => Promise.resolve(undefined)),
    activate: mock.fn(() => Promise.resolve()),
    delete: mock.fn(() => Promise.resolve()),
    findByPhone: mock.fn((): Promise<Account | undefined> => Promise.resolve(undefined)),
    findPasswordCredential: mock.fn((): Promise<PasswordCredential | undefined> => Promise.resolve(undefined)),
    create: mock.fn((record: AccountRecord): Promise<Account> => Promise.resolve({ id: ACCOUNT_ID, ...record })),
    createWithGoogle: mock.fn((): Promise<Account> => Promise.resolve(aGoogleRegistrant())),
    findDateOfBirth: mock.fn(),
    findPasswordHash: mock.fn((): Promise<string | undefined> => Promise.resolve(undefined)),
    setPasswordHash: mock.fn(() => Promise.resolve()),
    updateLockout: mock.fn((_accountId: string, change: (lockout: SignInLockout) => SignInLockout) => {
      storedLockout = change(storedLockout);
      return Promise.resolve(storedLockout);
    }),
    findByGoogleSubject: mock.fn((): Promise<Account | undefined> => Promise.resolve(undefined)),
    findGoogleSubject: mock.fn((): Promise<string | undefined> => Promise.resolve(undefined)),
    linkGoogle: mock.fn((): Promise<GoogleLinkResult> => Promise.resolve('linked')),
  };
  const verificationCodes = {
    findLatest: mock.fn((): Promise<VerificationCode | undefined> => Promise.resolve(undefined)),
    createWithinLimit: mock.fn((record: VerificationCodeRecord): Promise<VerificationCode | undefined> =>
      Promise.resolve({ ...record, id: 'code-1', channel: null, providerRequestId: null, attempts: 0, usedAt: null }),
    ),
    saveDelivery: mock.fn(() => Promise.resolve()),
    delete: mock.fn(() => Promise.resolve()),
    addAttempt: mock.fn(() => Promise.resolve(1)),
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
    verify: mock.fn((): Promise<Caller | undefined> => Promise.resolve(undefined)),
  };
  const googleIdTokens = {
    verify: mock.fn((idToken: string): Promise<string | undefined> =>
      Promise.resolve(idToken === GOOGLE_ID_TOKEN ? GOOGLE_SUBJECT : undefined),
    ),
  };
  const notifications = { sendCode: mock.fn(() => Promise.resolve(DELIVERY)) };
  const sessions = {
    start: mock.fn((): Promise<SessionTokens> => Promise.resolve(SESSION_TOKENS)),
    endAll: mock.fn(() => Promise.resolve()),
    isActive: mock.fn(() => Promise.resolve(true)),
  };

  const service = new AuthService(
    accounts as unknown as AccountsRepository,
    verificationCodes,
    passwordHasher,
    codeHasher,
    accessTokens as unknown as AccessTokens,
    googleIdTokens,
    notifications as unknown as NotificationsService,
    sessions as unknown as SessionsService,
  );
  return {
    service,
    accounts,
    verificationCodes,
    passwordHasher,
    accessTokens,
    googleIdTokens,
    notifications,
    sessions,
  };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('AuthService.register', () => {
  useFixedClock();

  // SEC-008: stored before it is sent, so a parallel request finds it and sends nothing.
  test('stores the code hashed with a 10-minute lifetime before sending it, then saves the channel', async () => {
    const { service, verificationCodes, notifications } = makeService();
    let storedBeforeSending = false;
    notifications.sendCode.mock.mockImplementation(() => {
      storedBeforeSending = verificationCodes.createWithinLimit.mock.callCount() === 1;
      return Promise.resolve(DELIVERY);
    });

    await service.register(PHONE);

    const [phone, sentCode] = notifications.sendCode.mock.calls[0]?.arguments as unknown as [string, string];
    assert.equal(phone, PHONE);
    assert.match(sentCode, /^\d{6}$/);
    assert.ok(storedBeforeSending);
    assert.deepEqual(verificationCodes.createWithinLimit.mock.calls[0]?.arguments, [
      {
        phone: PHONE,
        purpose: 'registration',
        codeHash: `${PHONE}:${sentCode}`,
        sentAt: NOW,
        expiresAt: new Date(NOW.getTime() + CODE_LIFETIME_MS),
      },
      CODE_SEND_LIMIT,
    ]);
    assert.deepEqual(verificationCodes.saveDelivery.mock.calls[0]?.arguments, ['code-1', DELIVERY]);
  });

  // SEC-007: a 429 here would tell that a reset code went to the number, so that it has an account.
  test('silently sends nothing when the phone reached a code limit', async () => {
    const { service, verificationCodes, notifications } = makeService();
    verificationCodes.createWithinLimit.mock.mockImplementation(() => Promise.resolve(undefined));

    await service.register(PHONE);

    assert.equal(notifications.sendCode.mock.callCount(), 0);
  });

  test('removes the stored code when no channel takes it', async () => {
    const { service, verificationCodes, notifications } = makeService();
    notifications.sendCode.mock.mockImplementation(() => Promise.reject(new Error('provider is down')));

    await assert.rejects(service.register(PHONE), /provider is down/);

    assert.deepEqual(verificationCodes.delete.mock.calls[0]?.arguments, ['code-1']);
    assert.equal(verificationCodes.saveDelivery.mock.callCount(), 0);
  });
});

describe('AuthService.verify', () => {
  useFixedClock();

  test('rejects a verification code issued more than 10 minutes ago', async () => {
    const { service, accounts, verificationCodes, notifications } = makeService();
    await service.register(PHONE);
    const [, sentCode] = notifications.sendCode.mock.calls[0]?.arguments as unknown as [string, string];
    // The repository hands back the row it stored, as a real one would.
    const stored = await verificationCodes.createWithinLimit.mock.calls[0]?.result;
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

  test('checks the latest registration code, not a reset code', async () => {
    const { service, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));

    await service.verify(aRegistration());

    assert.deepEqual(verificationCodes.findLatest.mock.calls[0]?.arguments, [PHONE, 'registration']);
  });

  test('rejects a code that was already used', async () => {
    const { service, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ usedAt: NOW })));

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
  });

  test('counts a wrong code as an attempt', async () => {
    const { service, verificationCodes } = makeService();
    const code = aCode();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(code));

    const verifying = service.verify(aRegistration({ code: '000000' }));

    await assert.rejects(verifying, isDomainError('INVALID_CODE'));
    assert.deepEqual(verificationCodes.addAttempt.mock.calls[0]?.arguments, [code.id]);
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
  });

  test('accepts the right code on the third attempt', async () => {
    const { service, verificationCodes, accounts } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    verificationCodes.addAttempt.mock.mockImplementation(() => Promise.resolve(MAX_CODE_ATTEMPTS));

    await service.verify(aRegistration());

    assert.equal(accounts.create.mock.callCount(), 1);
  });

  // The count comes from the repository, so guesses sent in parallel cannot get past it.
  test('rejects even the right code on the fourth attempt', async () => {
    const { service, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    verificationCodes.addAttempt.mock.mockImplementation(() => Promise.resolve(MAX_CODE_ATTEMPTS + 1));

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
    assert.equal(verificationCodes.markUsed.mock.callCount(), 0);
  });

  test('rejects the code when a parallel request used it first', async () => {
    const { service, accounts, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    verificationCodes.markUsed.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.verify(aRegistration()), isDomainError('INVALID_CODE'));
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  test('rejects a phone that already has an account', async () => {
    const { service, accounts, verificationCodes } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));

    await assert.rejects(service.verify(aRegistration()), isDomainError('CONFLICT'));
    assert.equal(accounts.create.mock.callCount(), 0);
  });

  test('creates a pending account and returns a 15-minute registration token', async () => {
    const { service, accounts, verificationCodes, accessTokens } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));

    const token = await service.verify(aRegistration());

    assert.deepEqual(accounts.create.mock.calls[0]?.arguments, [
      { phone: PHONE, role: 'user', status: 'pending', dateOfBirth: null },
    ]);
    assert.deepEqual(accessTokens.issue.mock.calls[0]?.arguments, [
      { kind: 'registrant', accountId: ACCOUNT_ID },
      REGISTRATION_TOKEN_SECONDS,
    ]);
    assert.deepEqual(token, { accessToken: SIGNED_TOKEN, expiresIn: REGISTRATION_TOKEN_SECONDS });
  });

  test('continues the pending account of a phone that verified before', async () => {
    const { service, accounts, verificationCodes, accessTokens } = makeService();
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode()));
    const pending = aPendingAccount({ id: OTHER_ACCOUNT_ID });
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(pending));

    await service.verify(aRegistration());

    assert.equal(accounts.create.mock.callCount(), 0);
    const [caller] = accessTokens.issue.mock.calls[0]?.arguments as unknown as [Record<string, unknown>];
    assert.deepEqual(caller, { kind: 'registrant', accountId: pending.id });
  });
});

describe('AuthService.registerWithGoogle', () => {
  test('creates a pending account for a new Google account and returns a 15-minute registration token', async () => {
    const { service, accounts, accessTokens } = makeService();

    const token = await service.registerWithGoogle(GOOGLE_ID_TOKEN);

    assert.deepEqual(accounts.createWithGoogle.mock.calls[0]?.arguments, [GOOGLE_SUBJECT]);
    assert.deepEqual(accessTokens.issue.mock.calls[0]?.arguments, [
      { kind: 'registrant', accountId: ACCOUNT_ID },
      REGISTRATION_TOKEN_SECONDS,
    ]);
    assert.deepEqual(token, { accessToken: SIGNED_TOKEN, expiresIn: REGISTRATION_TOKEN_SECONDS });
  });

  test('continues with the pending account of a Google account that registered before', async () => {
    const { service, accounts, accessTokens } = makeService();
    accounts.findByGoogleSubject.mock.mockImplementation(() =>
      Promise.resolve(aGoogleRegistrant({ id: OTHER_ACCOUNT_ID })),
    );

    await service.registerWithGoogle(GOOGLE_ID_TOKEN);

    assert.equal(accounts.createWithGoogle.mock.callCount(), 0);
    assert.deepEqual(accessTokens.issue.mock.calls[0]?.arguments[0], {
      kind: 'registrant',
      accountId: OTHER_ACCOUNT_ID,
    });
  });

  const takenCases = [
    { title: 'refuses a Google account that is already registered', account: anAccount({ phone: null }) },
    { title: 'refuses a Google account of a banned account', account: anAccount({ phone: null, status: 'banned' }) },
  ];

  for (const { title, account } of takenCases) {
    test(title, async () => {
      const { service, accounts, accessTokens } = makeService();
      accounts.findByGoogleSubject.mock.mockImplementation(() => Promise.resolve(account));

      await assert.rejects(service.registerWithGoogle(GOOGLE_ID_TOKEN), isDomainError('GOOGLE_ACCOUNT_TAKEN'));
      assert.equal(accessTokens.issue.mock.callCount(), 0);
    });
  }

  test('rejects an invalid ID token without looking up an account', async () => {
    const { service, accounts } = makeService();

    await assert.rejects(service.registerWithGoogle('forged'), isDomainError('INVALID_GOOGLE_TOKEN'));
    assert.equal(accounts.findByGoogleSubject.mock.callCount(), 0);
    assert.equal(accounts.createWithGoogle.mock.callCount(), 0);
  });
});

describe('AuthService.completeRegistration', () => {
  useFixedClock();

  test('activates the account with the date of birth and starts its first session', async () => {
    const { service, accounts, sessions } = makeService();
    const pending = aPendingAccount();
    accounts.findById.mock.mockImplementation(() => Promise.resolve(pending));

    const tokens = await service.completeRegistration(pending.id, ADULT_BIRTH_DATE);

    assert.deepEqual(accounts.activate.mock.calls[0]?.arguments, [pending.id, ADULT_BIRTH_DATE]);
    assert.deepEqual(sessions.start.mock.calls[0]?.arguments, [pending.id, pending.role]);
    assert.deepEqual(tokens, SESSION_TOKENS);
  });

  test('removes the registration of someone under 18, so the number can start again', async () => {
    const { service, accounts, sessions } = makeService();
    const pending = aPendingAccount();
    accounts.findById.mock.mockImplementation(() => Promise.resolve(pending));

    const completing = service.completeRegistration(pending.id, '2010-01-01');

    await assert.rejects(completing, isDomainError('UNDERAGE'));
    assert.deepEqual(accounts.delete.mock.calls[0]?.arguments, [pending.id]);
    assert.equal(accounts.activate.mock.callCount(), 0);
    assert.equal(sessions.start.mock.callCount(), 0);
  });

  test('refuses an account that already finished registration', async () => {
    const { service, accounts } = makeService();
    accounts.findById.mock.mockImplementation(() => Promise.resolve(anAccount()));

    await assert.rejects(service.completeRegistration(ACCOUNT_ID, ADULT_BIRTH_DATE), isDomainError('CONFLICT'));
    assert.equal(accounts.activate.mock.callCount(), 0);
  });

  test('refuses a registration that was removed', async () => {
    const { service } = makeService();

    await assert.rejects(service.completeRegistration(ACCOUNT_ID, ADULT_BIRTH_DATE), isDomainError('NOT_FOUND'));
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
      const { service, accounts } = makeService();
      accounts.findById.mock.mockImplementation(() => Promise.resolve(aPendingAccount()));

      const completing = service.completeRegistration(ACCOUNT_ID, dateOfBirth);

      if (adult) {
        await completing;
      } else {
        await assert.rejects(completing, isDomainError('UNDERAGE'));
      }
    });
  }
});

describe('AuthService.requestPasswordReset', () => {
  useFixedClock();

  test('sends a reset code to an active account', async () => {
    const { service, accounts, verificationCodes, notifications } = makeService();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));

    await service.requestPasswordReset(PHONE);
    await setImmediate();

    const [phone, sentCode] = notifications.sendCode.mock.calls[0]?.arguments as unknown as [string, string];
    assert.equal(phone, PHONE);
    assert.deepEqual(verificationCodes.createWithinLimit.mock.calls[0]?.arguments, [
      {
        phone: PHONE,
        purpose: 'reset',
        codeHash: `${PHONE}:${sentCode}`,
        sentAt: NOW,
        expiresAt: new Date(NOW.getTime() + CODE_LIFETIME_MS),
      },
      CODE_SEND_LIMIT,
    ]);
    assert.deepEqual(verificationCodes.saveDelivery.mock.calls[0]?.arguments, ['code-1', DELIVERY]);
  });

  // SEC-007: the provider's response time must not tell an account from an unknown phone.
  test('returns without waiting for the provider', async () => {
    const { service, accounts, notifications } = makeService();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));
    notifications.sendCode.mock.mockImplementation(() => new Promise<CodeDelivery>(() => {}));

    await service.requestPasswordReset(PHONE);

    assert.equal(notifications.sendCode.mock.callCount(), 1);
  });

  test('logs a code that could not be sent instead of failing', async () => {
    const { service, accounts, verificationCodes, notifications } = makeService();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));
    notifications.sendCode.mock.mockImplementation(() => Promise.reject(new Error('provider is down')));
    const logError = mock.method(Logger.prototype, 'error', () => {});

    await service.requestPasswordReset(PHONE);
    await setImmediate();

    assert.equal(logError.mock.callCount(), 1);
    assert.deepEqual(verificationCodes.delete.mock.calls[0]?.arguments, ['code-1']);
    logError.mock.restore();
  });

  test('logs the thrown value itself when sending fails with something that is not an Error', async () => {
    const { service, accounts, notifications } = makeService();
    const reason = 'provider is down';
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));
    notifications.sendCode.mock.mockImplementation(() => Promise.reject(reason));
    const logError = mock.method(Logger.prototype, 'error', () => {});

    await service.requestPasswordReset(PHONE);
    await setImmediate();

    assert.equal(logError.mock.calls[0]?.arguments[1], reason);
    logError.mock.restore();
  });

  const noCodeCases = [
    { title: 'sends nothing to a phone without an account', account: undefined },
    { title: 'sends nothing to a banned account', account: anAccount({ status: 'banned' }) },
    { title: 'sends nothing to an account that has not finished registration', account: aPendingAccount() },
  ];

  for (const { title, account } of noCodeCases) {
    test(title, async () => {
      const { service, accounts, notifications } = makeService();
      accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(account));

      await service.requestPasswordReset(PHONE);
      await setImmediate();

      assert.equal(notifications.sendCode.mock.callCount(), 0);
    });
  }

  test('silently sends nothing when the phone reached a code limit', async () => {
    const { service, accounts, verificationCodes, notifications } = makeService();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));
    verificationCodes.createWithinLimit.mock.mockImplementation(() => Promise.resolve(undefined));

    await service.requestPasswordReset(PHONE);
    await setImmediate();

    assert.equal(notifications.sendCode.mock.callCount(), 0);
  });
});

describe('AuthService.resetPassword', () => {
  useFixedClock();

  test('checks the latest reset code, replaces the password, lifts a lock and signs in', async () => {
    const lockout = { ...NO_LOCKOUT, lockedUntil: new Date(NOW.getTime() + 1) };
    const { service, accounts, verificationCodes, sessions } = makeService({ lockout });
    const account = anAccount();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(account));
    const code = aCode({ purpose: 'reset' });
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(code));
    const reset = aPasswordReset();

    const token = await service.resetPassword(reset);

    assert.deepEqual(verificationCodes.findLatest.mock.calls[0]?.arguments, [PHONE, 'reset']);
    assert.deepEqual(verificationCodes.markUsed.mock.calls[0]?.arguments, [code.id, NOW]);
    assert.deepEqual(accounts.setPasswordHash.mock.calls[0]?.arguments, [account.id, `hash(${reset.password})`]);
    assert.equal(accounts.updateLockout.mock.calls[0]?.arguments[0], account.id);
    assert.deepEqual(await accounts.updateLockout.mock.calls[0]?.result, NO_LOCKOUT);
    assert.deepEqual(sessions.start.mock.calls[0]?.arguments, [account.id, account.role]);
    assert.deepEqual(token, SESSION_TOKENS);
  });

  // TM-01: whoever signed in with the old password is signed out.
  test('ends every session of the account before starting a new one', async () => {
    const { service, accounts, verificationCodes, sessions } = makeService();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ purpose: 'reset' })));
    let endedBeforeStart = false;
    sessions.start.mock.mockImplementation(() => {
      endedBeforeStart = sessions.endAll.mock.callCount() === 1;
      return Promise.resolve(SESSION_TOKENS);
    });

    await service.resetPassword(aPasswordReset());

    assert.deepEqual(sessions.endAll.mock.calls[0]?.arguments, [ACCOUNT_ID]);
    assert.ok(endedBeforeStart);
  });

  test('rejects a wrong code without changing the password', async () => {
    const { service, accounts, verificationCodes } = makeService();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount()));
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ purpose: 'reset' })));

    await assert.rejects(service.resetPassword(aPasswordReset({ code: '000000' })), isDomainError('INVALID_CODE'));
    assert.equal(accounts.setPasswordHash.mock.callCount(), 0);
  });

  test('rejects the code of an account banned after it was sent', async () => {
    const { service, accounts, verificationCodes, sessions } = makeService();
    accounts.findByPhone.mock.mockImplementation(() => Promise.resolve(anAccount({ status: 'banned' })));
    verificationCodes.findLatest.mock.mockImplementation(() => Promise.resolve(aCode({ purpose: 'reset' })));

    await assert.rejects(service.resetPassword(aPasswordReset()), isDomainError('INVALID_CODE'));
    assert.equal(accounts.setPasswordHash.mock.callCount(), 0);
    assert.equal(sessions.start.mock.callCount(), 0);
  });
});

describe('AuthService.setPassword', () => {
  useFixedClock();
  const NEW_PASSWORD = 'a new long passphrase';

  test('sets the first password without asking for a current one', async () => {
    const { service, accounts, passwordHasher } = makeService();

    await service.setPassword(ACCOUNT_ID, SESSION_ID, NEW_PASSWORD);

    assert.equal(passwordHasher.verify.mock.callCount(), 0);
    assert.deepEqual(accounts.setPasswordHash.mock.calls[0]?.arguments, [ACCOUNT_ID, `hash(${NEW_PASSWORD})`]);
  });

  test('ends every other session of the account once the password is set', async () => {
    const { service, sessions } = makeService();

    await service.setPassword(ACCOUNT_ID, SESSION_ID, NEW_PASSWORD);

    assert.deepEqual(sessions.endAll.mock.calls[0]?.arguments, [ACCOUNT_ID, SESSION_ID]);
  });

  test('replaces the password when the current one is right', async () => {
    const { service, accounts, passwordHasher } = makeService();
    accounts.findPasswordHash.mock.mockImplementation(() => Promise.resolve('stored-hash'));

    await service.setPassword(ACCOUNT_ID, SESSION_ID, NEW_PASSWORD, PASSWORD);

    assert.deepEqual(passwordHasher.verify.mock.calls[0]?.arguments, ['stored-hash', PASSWORD]);
    assert.deepEqual(accounts.setPasswordHash.mock.calls[0]?.arguments, [ACCOUNT_ID, `hash(${NEW_PASSWORD})`]);
  });

  test('refuses to replace a password without the current one, counting nothing', async () => {
    const { service, accounts, sessions } = makeService();
    accounts.findPasswordHash.mock.mockImplementation(() => Promise.resolve('stored-hash'));

    await assert.rejects(service.setPassword(ACCOUNT_ID, SESSION_ID, NEW_PASSWORD), isDomainError('WRONG_PASSWORD'));
    assert.equal(accounts.setPasswordHash.mock.callCount(), 0);
    assert.equal(accounts.updateLockout.mock.callCount(), 0);
    assert.equal(sessions.endAll.mock.callCount(), 0);
  });

  // SEC-007: a stolen session must not give unlimited guesses at the password.
  test('refuses a wrong current password and counts it as a failed sign-in', async () => {
    const { service, accounts, passwordHasher, sessions } = makeService();
    accounts.findPasswordHash.mock.mockImplementation(() => Promise.resolve('stored-hash'));
    passwordHasher.verify.mock.mockImplementation(() => Promise.resolve(false));

    const setting = service.setPassword(ACCOUNT_ID, SESSION_ID, NEW_PASSWORD, 'wrong-password');

    await assert.rejects(setting, isDomainError('WRONG_PASSWORD'));
    assert.equal(accounts.setPasswordHash.mock.callCount(), 0);
    assert.equal(sessions.endAll.mock.callCount(), 0);
    assert.equal(accounts.updateLockout.mock.calls[0]?.arguments[0], ACCOUNT_ID);
    assert.deepEqual(await accounts.updateLockout.mock.calls[0]?.result, {
      failedSignins: 1,
      failedSigninsSince: NOW,
      lockedUntil: null,
    });
  });

  test('clears earlier failed sign-ins when the current password is right', async () => {
    const { service, accounts } = makeService({
      lockout: { failedSignins: 2, failedSigninsSince: NOW, lockedUntil: null },
    });
    accounts.findPasswordHash.mock.mockImplementation(() => Promise.resolve('stored-hash'));

    await service.setPassword(ACCOUNT_ID, SESSION_ID, NEW_PASSWORD, PASSWORD);

    assert.deepEqual(await accounts.updateLockout.mock.calls[0]?.result, NO_LOCKOUT);
  });

  test('refuses even the right current password on a locked account', async () => {
    const { service, accounts, sessions } = makeService({
      lockout: { ...NO_LOCKOUT, lockedUntil: new Date(NOW.getTime() + 1) },
    });
    accounts.findPasswordHash.mock.mockImplementation(() => Promise.resolve('stored-hash'));

    await assert.rejects(
      service.setPassword(ACCOUNT_ID, SESSION_ID, NEW_PASSWORD, PASSWORD),
      isDomainError('WRONG_PASSWORD'),
    );
    assert.equal(accounts.setPasswordHash.mock.callCount(), 0);
    assert.equal(sessions.endAll.mock.callCount(), 0);
  });
});

describe('AuthService.signIn', () => {
  useFixedClock();

  test("starts a session for the account with the credential's role", async () => {
    const { service, accounts, sessions } = makeService();
    // Not the default role, so a service that ignored the credential's role would fail.
    const credential = aCredential({ role: 'admin' });
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(credential));

    const token = await service.signIn(PHONE, PASSWORD);

    assert.deepEqual(sessions.start.mock.calls[0]?.arguments, [credential.accountId, credential.role]);
    assert.deepEqual(token, SESSION_TOKENS);
  });

  // SEC-007: an unknown phone costs one hash check, like a known one, so the response time does not reveal it.
  test('checks every unknown phone against the stand-in hash made at startup, hashing nothing more', async () => {
    const { service, passwordHasher } = makeService();
    await service.onModuleInit();
    assert.equal(passwordHasher.hash.mock.callCount(), 1);
    const standIn = await passwordHasher.hash.mock.calls[0]?.result;

    await assert.rejects(service.signIn(PHONE, PASSWORD), isDomainError('INVALID_CREDENTIALS'));
    await assert.rejects(service.signIn('+380501234500', PASSWORD), isDomainError('INVALID_CREDENTIALS'));

    assert.equal(passwordHasher.hash.mock.callCount(), 1);
    assert.deepEqual(
      passwordHasher.verify.mock.calls.map((call) => call.arguments),
      [
        [standIn, PASSWORD],
        [standIn, PASSWORD],
      ],
    );
  });

  test('rejects a wrong password', async () => {
    const { service, accounts, passwordHasher, sessions } = makeService();
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential()));
    passwordHasher.verify.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.signIn(PHONE, 'wrong-password'), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(sessions.start.mock.callCount(), 0);
  });

  test('rejects a banned account even with the right password', async () => {
    const { service, accounts, sessions } = makeService();
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential({ status: 'banned' })));

    await assert.rejects(service.signIn(PHONE, PASSWORD), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(sessions.start.mock.callCount(), 0);
  });

  // SEC-007
  test('records a wrong password as a failed sign-in', async () => {
    const { service, accounts, passwordHasher } = makeService();
    const credential = aCredential();
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(credential));
    passwordHasher.verify.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.signIn(PHONE, 'wrong-password'), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(accounts.updateLockout.mock.calls[0]?.arguments[0], credential.accountId);
    assert.deepEqual(await accounts.updateLockout.mock.calls[0]?.result, {
      failedSignins: 1,
      failedSigninsSince: NOW,
      lockedUntil: null,
    });
  });

  // SEC-007: each failure is counted on the stored state, so parallel guesses cannot get past the lock.
  test('locks an account after 5 wrong passwords sent in parallel', async () => {
    const { service, accounts, passwordHasher } = makeService();
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential()));
    passwordHasher.verify.mock.mockImplementation(() => Promise.resolve(false));

    const signIns = Array.from({ length: 5 }, () => service.signIn(PHONE, 'wrong-password'));

    await Promise.allSettled(signIns);
    const lockout = await accounts.updateLockout.mock.calls[4]?.result;
    assert.deepEqual(lockout?.lockedUntil, new Date(NOW.getTime() + 15 * 60 * 1000));
  });

  // SEC-007: a locked account answers like a wrong password and does not extend its lock.
  test('refuses a locked account even with the right password, counting nothing', async () => {
    const lockout = { ...NO_LOCKOUT, lockedUntil: new Date(NOW.getTime() + 1) };
    const { service, accounts, passwordHasher, sessions } = makeService({ lockout });
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential()));

    await assert.rejects(service.signIn(PHONE, PASSWORD), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(passwordHasher.verify.mock.callCount(), 1);
    assert.deepEqual(await accounts.updateLockout.mock.calls[0]?.result, lockout);
    assert.equal(sessions.start.mock.callCount(), 0);
  });

  test('signs in from the moment the lock ends', async () => {
    const { service, accounts, sessions } = makeService({ lockout: { ...NO_LOCKOUT, lockedUntil: NOW } });
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential()));

    await service.signIn(PHONE, PASSWORD);

    assert.equal(sessions.start.mock.callCount(), 1);
  });

  test('clears earlier failed sign-ins on success', async () => {
    const { service, accounts } = makeService({
      lockout: { failedSignins: 2, failedSigninsSince: NOW, lockedUntil: null },
    });
    accounts.findPasswordCredential.mock.mockImplementation(() => Promise.resolve(aCredential()));

    await service.signIn(PHONE, PASSWORD);

    assert.deepEqual(await accounts.updateLockout.mock.calls[0]?.result, NO_LOCKOUT);
  });
});

describe('AuthService.signInWithGoogle', () => {
  test('signs in the account that linked the Google account', async () => {
    const { service, accounts, sessions } = makeService();
    const account = anAccount({ role: 'admin' });
    accounts.findByGoogleSubject.mock.mockImplementation(() => Promise.resolve(account));

    const token = await service.signInWithGoogle(GOOGLE_ID_TOKEN);

    assert.deepEqual(accounts.findByGoogleSubject.mock.calls[0]?.arguments, [GOOGLE_SUBJECT]);
    assert.deepEqual(sessions.start.mock.calls[0]?.arguments, [account.id, account.role]);
    assert.deepEqual(token, SESSION_TOKENS);
  });

  test('rejects an invalid ID token without looking up an account', async () => {
    const { service, accounts } = makeService();

    await assert.rejects(service.signInWithGoogle('forged'), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(accounts.findByGoogleSubject.mock.callCount(), 0);
  });

  test('rejects a Google account no account linked', async () => {
    const { service, sessions } = makeService();

    await assert.rejects(service.signInWithGoogle(GOOGLE_ID_TOKEN), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(sessions.start.mock.callCount(), 0);
  });

  test('rejects a Google account whose registration is not complete', async () => {
    const { service, accounts, sessions } = makeService();
    accounts.findByGoogleSubject.mock.mockImplementation(() => Promise.resolve(aGoogleRegistrant()));

    await assert.rejects(service.signInWithGoogle(GOOGLE_ID_TOKEN), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(sessions.start.mock.callCount(), 0);
  });

  test('rejects a banned account', async () => {
    const { service, accounts, sessions } = makeService();
    accounts.findByGoogleSubject.mock.mockImplementation(() => Promise.resolve(anAccount({ status: 'banned' })));

    await assert.rejects(service.signInWithGoogle(GOOGLE_ID_TOKEN), isDomainError('INVALID_CREDENTIALS'));
    assert.equal(sessions.start.mock.callCount(), 0);
  });
});

describe('AuthService.linkGoogle', () => {
  test('links the Google account to the signed-in account', async () => {
    const { service, accounts } = makeService();

    await service.linkGoogle(ACCOUNT_ID, GOOGLE_ID_TOKEN);

    assert.deepEqual(accounts.linkGoogle.mock.calls[0]?.arguments, [ACCOUNT_ID, GOOGLE_SUBJECT]);
  });

  test('rejects an invalid ID token', async () => {
    const { service, accounts } = makeService();

    await assert.rejects(service.linkGoogle(ACCOUNT_ID, 'forged'), isDomainError('INVALID_GOOGLE_TOKEN'));
    assert.equal(accounts.linkGoogle.mock.callCount(), 0);
  });

  test('changes nothing when the account already linked this Google account', async () => {
    const { service, accounts } = makeService();
    accounts.findByGoogleSubject.mock.mockImplementation(() => Promise.resolve(anAccount({ id: ACCOUNT_ID })));

    await service.linkGoogle(ACCOUNT_ID, GOOGLE_ID_TOKEN);

    assert.equal(accounts.linkGoogle.mock.callCount(), 0);
  });

  test('refuses a Google account another account linked', async () => {
    const { service, accounts } = makeService();
    accounts.findByGoogleSubject.mock.mockImplementation(() => Promise.resolve(anAccount({ id: OTHER_ACCOUNT_ID })));

    await assert.rejects(service.linkGoogle(ACCOUNT_ID, GOOGLE_ID_TOKEN), isDomainError('GOOGLE_ACCOUNT_TAKEN'));
    assert.equal(accounts.linkGoogle.mock.callCount(), 0);
  });

  test('refuses a second Google account', async () => {
    const { service, accounts } = makeService();
    accounts.findGoogleSubject.mock.mockImplementation(() => Promise.resolve('another-google-subject'));

    await assert.rejects(service.linkGoogle(ACCOUNT_ID, GOOGLE_ID_TOKEN), isDomainError('GOOGLE_ALREADY_LINKED'));
    assert.equal(accounts.linkGoogle.mock.callCount(), 0);
  });

  test('refuses a Google account another account linked at the same time', async () => {
    const { service, accounts } = makeService();
    accounts.linkGoogle.mock.mockImplementation(() => Promise.resolve('subject-taken'));

    await assert.rejects(service.linkGoogle(ACCOUNT_ID, GOOGLE_ID_TOKEN), isDomainError('GOOGLE_ACCOUNT_TAKEN'));
  });

  test('refuses a second Google account linked at the same time', async () => {
    const { service, accounts } = makeService();
    accounts.linkGoogle.mock.mockImplementation(() => Promise.resolve('account-has-google'));

    await assert.rejects(service.linkGoogle(ACCOUNT_ID, GOOGLE_ID_TOKEN), isDomainError('GOOGLE_ALREADY_LINKED'));
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

// SEC-005: a sign-out or ban takes effect before the access token expires.
describe('AuthService.authenticate', () => {
  const accountCaller = { kind: 'account', accountId: ACCOUNT_ID, role: 'user', sessionId: SESSION_ID } as const;

  test('accepts the token of an account while its session is active', async () => {
    const { service, accessTokens, sessions } = makeService();
    accessTokens.verify.mock.mockImplementation(() => Promise.resolve(accountCaller));

    const caller = await service.authenticate(SIGNED_TOKEN);

    assert.deepEqual(sessions.isActive.mock.calls[0]?.arguments, [SESSION_ID, ACCOUNT_ID]);
    assert.deepEqual(caller, accountCaller);
  });

  test('refuses the token of an account whose session ended', async () => {
    const { service, accessTokens, sessions } = makeService();
    accessTokens.verify.mock.mockImplementation(() => Promise.resolve(accountCaller));
    sessions.isActive.mock.mockImplementation(() => Promise.resolve(false));

    assert.equal(await service.authenticate(SIGNED_TOKEN), undefined);
  });

  test('accepts a guest token without a session', async () => {
    const { service, accessTokens, sessions } = makeService();
    const guest = { kind: 'guest', guestId: OTHER_ACCOUNT_ID } as const;
    accessTokens.verify.mock.mockImplementation(() => Promise.resolve(guest));

    assert.deepEqual(await service.authenticate(SIGNED_TOKEN), guest);
    assert.equal(sessions.isActive.mock.callCount(), 0);
  });
});
