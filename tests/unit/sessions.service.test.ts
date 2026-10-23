// Written with the help of Claude
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { SessionsService } from '../../dist/core/identity/services/sessions.service.js';
import type { AccessTokens } from '../../dist/core/identity/adapters/access-tokens.js';
import type { AccountsRepository } from '../../dist/core/identity/repositories/accounts.repository.js';
import type { SessionsRepository } from '../../dist/core/identity/repositories/sessions.repository.js';
import type { Account } from '../../dist/core/identity/types/account.js';
import type { Session, SessionRecord } from '../../dist/core/identity/types/session.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID, PHONE } from './fixtures/accounts.ts';
import { NOW, useFixedClock } from './fixtures/clock.ts';

const SESSION_ID = 'b0000000-0000-4000-8000-000000000001';
const SECRET = 'c'.repeat(43);
const SIGNED_TOKEN = 'signed-token';
// SEC-005
const ACCESS_TOKEN_SECONDS = 60 * 60;
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN = /^b0000000-0000-4000-8000-000000000001\.([\w-]{43})$/;

function hashOf(secret: string): string {
  return createHash('sha256').update(secret).digest('base64url');
}

/** The session of ACCOUNT_ID whose refresh token is `SESSION_ID.SECRET`. */
function aSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    accountId: ACCOUNT_ID,
    tokenHash: hashOf(SECRET),
    expiresAt: new Date(NOW.getTime() + REFRESH_TOKEN_MS),
    revokedAt: null,
    accountStatus: 'active',
    ...overrides,
  };
}

function anAccount(overrides: Partial<Account> = {}): Account {
  return { id: ACCOUNT_ID, phone: PHONE, role: 'user', status: 'active', dateOfBirth: '2001-04-12', ...overrides };
}

/** Every port of SessionsService as a mock; the stored session is `aSession()` and its account is active. */
function makeService() {
  const sessions = {
    create: mock.fn((record: SessionRecord): Promise<Session> => Promise.resolve(aSession(record))),
    findById: mock.fn((): Promise<Session | undefined> => Promise.resolve(aSession())),
    rotate: mock.fn(() => Promise.resolve(true)),
    revoke: mock.fn(() => Promise.resolve()),
    revokeAll: mock.fn(() => Promise.resolve()),
  };
  const accounts = { findById: mock.fn((): Promise<Account | undefined> => Promise.resolve(anAccount())) };
  const accessTokens = { issue: mock.fn(() => Promise.resolve(SIGNED_TOKEN)), verify: mock.fn() };

  const service = new SessionsService(
    sessions as unknown as SessionsRepository,
    accounts as unknown as AccountsRepository,
    accessTokens as unknown as AccessTokens,
  );
  return { service, sessions, accounts, accessTokens };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('SessionsService.start', () => {
  useFixedClock();

  test('stores the hash of a new secret for 30 days and returns it with an access token of the session', async () => {
    const { service, sessions, accessTokens } = makeService();

    const tokens = await service.start(ACCOUNT_ID, 'admin');

    const secret = REFRESH_TOKEN.exec(tokens.refreshToken)?.[1] ?? '';
    assert.deepEqual(sessions.create.mock.calls[0]?.arguments, [
      { accountId: ACCOUNT_ID, tokenHash: hashOf(secret), expiresAt: new Date(NOW.getTime() + REFRESH_TOKEN_MS) },
    ]);
    assert.deepEqual(accessTokens.issue.mock.calls[0]?.arguments, [
      { kind: 'account', accountId: ACCOUNT_ID, role: 'admin', sessionId: SESSION_ID },
      ACCESS_TOKEN_SECONDS,
    ]);
    assert.equal(tokens.accessToken, SIGNED_TOKEN);
    assert.equal(tokens.expiresIn, ACCESS_TOKEN_SECONDS);
  });

  test('gives every session another secret', async () => {
    const { service } = makeService();

    const first = await service.start(ACCOUNT_ID, 'user');
    const second = await service.start(ACCOUNT_ID, 'user');

    assert.notEqual(first.refreshToken, second.refreshToken);
  });
});

describe('SessionsService.refresh', () => {
  useFixedClock();

  test('replaces the secret, extends the session by 30 days and issues an access token for the account', async () => {
    const { service, sessions, accessTokens } = makeService();

    const tokens = await service.refresh(`${SESSION_ID}.${SECRET}`);

    const secret = REFRESH_TOKEN.exec(tokens.refreshToken)?.[1] ?? '';
    assert.notEqual(secret, SECRET);
    assert.deepEqual(sessions.rotate.mock.calls[0]?.arguments, [
      SESSION_ID,
      hashOf(SECRET),
      { tokenHash: hashOf(secret), expiresAt: new Date(NOW.getTime() + REFRESH_TOKEN_MS) },
    ]);
    assert.deepEqual(accessTokens.issue.mock.calls[0]?.arguments, [
      { kind: 'account', accountId: ACCOUNT_ID, role: 'user', sessionId: SESSION_ID },
      ACCESS_TOKEN_SECONDS,
    ]);
    assert.equal(sessions.revoke.mock.callCount(), 0);
  });

  const malformed = ['', 'not-a-token', `${SESSION_ID}.short`, `not-a-uuid.${SECRET}`, `${SESSION_ID}${SECRET}`];

  for (const token of malformed) {
    test(`rejects ${JSON.stringify(token)} without looking up a session`, async () => {
      const { service, sessions } = makeService();

      await assert.rejects(service.refresh(token), isDomainError('INVALID_REFRESH_TOKEN'));
      assert.equal(sessions.findById.mock.callCount(), 0);
    });
  }

  const endedCases = [
    { title: 'rejects the token of a session that does not exist', session: undefined },
    { title: 'rejects the token of a session that was ended', session: aSession({ revokedAt: NOW }) },
    { title: 'rejects the token of a session that expired', session: aSession({ expiresAt: NOW }) },
  ];

  for (const { title, session } of endedCases) {
    test(title, async () => {
      const { service, sessions } = makeService();
      sessions.findById.mock.mockImplementation(() => Promise.resolve(session));

      await assert.rejects(service.refresh(`${SESSION_ID}.${SECRET}`), isDomainError('INVALID_REFRESH_TOKEN'));
      assert.equal(sessions.rotate.mock.callCount(), 0);
    });
  }

  // A rotated token coming back means two holders: the session ends for both. Any wrong secret counts, since only
  // the current hash is stored and an older token cannot be told from a guess.
  test('ends the session when a wrong secret comes', async () => {
    const { service, sessions } = makeService();

    await assert.rejects(service.refresh(`${SESSION_ID}.${'d'.repeat(43)}`), isDomainError('INVALID_REFRESH_TOKEN'));
    assert.deepEqual(sessions.revoke.mock.calls[0]?.arguments, [SESSION_ID, NOW]);
    assert.equal(sessions.rotate.mock.callCount(), 0);
  });

  test('ends the session of an account that was banned', async () => {
    const { service, sessions, accounts } = makeService();
    accounts.findById.mock.mockImplementation(() => Promise.resolve(anAccount({ status: 'banned' })));

    await assert.rejects(service.refresh(`${SESSION_ID}.${SECRET}`), isDomainError('INVALID_REFRESH_TOKEN'));
    assert.deepEqual(sessions.revoke.mock.calls[0]?.arguments, [SESSION_ID, NOW]);
  });

  test('ends the session when a concurrent refresh rotated the token first', async () => {
    const { service, sessions, accessTokens } = makeService();
    sessions.rotate.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.refresh(`${SESSION_ID}.${SECRET}`), isDomainError('INVALID_REFRESH_TOKEN'));
    assert.deepEqual(sessions.revoke.mock.calls[0]?.arguments, [SESSION_ID, NOW]);
    assert.equal(accessTokens.issue.mock.callCount(), 0);
  });
});

describe('SessionsService.end', () => {
  useFixedClock();

  test('revokes the session now', async () => {
    const { service, sessions } = makeService();

    await service.end(SESSION_ID);

    assert.deepEqual(sessions.revoke.mock.calls[0]?.arguments, [SESSION_ID, NOW]);
  });
});

describe('SessionsService.endAll', () => {
  useFixedClock();

  test('revokes every session of the account but the one given', async () => {
    const { service, sessions } = makeService();

    await service.endAll(ACCOUNT_ID, SESSION_ID);

    assert.deepEqual(sessions.revokeAll.mock.calls[0]?.arguments, [ACCOUNT_ID, NOW, SESSION_ID]);
  });
});

describe('SessionsService.isActive', () => {
  useFixedClock();

  const cases = [
    { title: 'is true for a session that is neither ended nor expired', session: aSession(), active: true },
    { title: 'is false for a session that does not exist', session: undefined, active: false },
    { title: 'is false for a session that was ended', session: aSession({ revokedAt: NOW }), active: false },
    { title: 'is false for a session that expired', session: aSession({ expiresAt: NOW }), active: false },
    {
      title: 'is false for the session of a banned account',
      session: aSession({ accountStatus: 'banned' }),
      active: false,
    },
    {
      title: 'is false for the session of another account',
      session: aSession({ accountId: OTHER_ACCOUNT_ID }),
      active: false,
    },
  ];

  for (const { title, session, active } of cases) {
    test(title, async () => {
      const { service, sessions } = makeService();
      sessions.findById.mock.mockImplementation(() => Promise.resolve(session));

      assert.equal(await service.isActive(SESSION_ID, ACCOUNT_ID), active);
    });
  }
});
