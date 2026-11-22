// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { EventSessionsService } from '../../dist/core/catalog/services/event-sessions.service.js';
import type { EventSession } from '../../dist/core/catalog/types/event-session.js';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { MatchesRepository } from '../../dist/core/matching/repositories/matches.repository.js';
import { MatchesService } from '../../dist/core/matching/services/matches.service.js';
import type { Application } from '../../dist/core/matching/types/application.js';
import type { MatchRecord, MatchStatus } from '../../dist/core/matching/types/match.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { Contacts, PublicProfile } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { EVENT_ID } from './fixtures/catalog.ts';
import { NOW, useFixedClock } from './fixtures/clock.ts';

const TX = {} as Transaction;
const STRANGER_ID = 'a0000000-0000-4000-8000-000000000003';
const DAY_1 = '5e000000-0000-4000-8000-000000000001';
const DAY_2 = '5e000000-0000-4000-8000-000000000002';
const DAY_3 = '5e000000-0000-4000-8000-000000000003';

function aSession(id: string, startsAt: string): EventSession {
  const cutoffAt = new Date(Date.parse(startsAt) - 60 * 60 * 1000).toISOString();
  return { id, eventId: EVENT_ID, startsAt, cutoffAt, status: 'scheduled' };
}

const SESSIONS = new Map([
  [DAY_1, aSession(DAY_1, '2026-10-25T17:00:00.000Z')],
  [DAY_2, aSession(DAY_2, '2026-10-26T17:00:00.000Z')],
  [DAY_3, aSession(DAY_3, '2026-10-27T17:00:00.000Z')],
]);

function anApplication(id: string, userId: string, sessionIds: string[]): Application {
  return {
    id,
    userId,
    eventId: EVENT_ID,
    sessionIds,
    desiredCompany: 'company',
    afterEventPlans: ['walk'],
    status: 'paired',
    createdAt: NOW.toISOString(),
  };
}

function aMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 'match-1',
    applicationAId: 'application-a',
    applicationBId: 'application-b',
    source: 'round',
    score: 0.7,
    seed: 1,
    status: 'proposed',
    validUntil: '2026-10-16T09:00:00.000Z',
    createdAt: NOW.toISOString(),
    eventId: EVENT_ID,
    // The caller can go on days 2 and 1, the other on days 2 and 3.
    applicationA: anApplication('application-a', ACCOUNT_ID, [DAY_2, DAY_1]),
    applicationB: anApplication('application-b', OTHER_ACCOUNT_ID, [DAY_3, DAY_2]),
    ...overrides,
  };
}

const OTHER_PROFILE: PublicProfile = {
  accountId: OTHER_ACCOUNT_ID,
  username: 'olena',
  displayName: 'Олена',
  description: 'Джаз і довгі прогулянки',
  occupation: 'Ілюстраторка',
  age: 24,
  interests: [{ id: 'jazz', name: 'Джаз', group: 'Музика' }],
};

const CONTACTS: Contacts = {
  phone: null,
  linkedAccounts: [{ network: 'telegram', username: 'olena', url: 'https://t.me/olena' }],
};

/** `stored` is the match the repository has; null for none. */
function makeService(stored: MatchRecord | null = aMatch()) {
  const calls: string[] = [];
  const matchesRepository = {
    findById: mock.fn<(id: string, tx?: Transaction) => Promise<MatchRecord | undefined>>((_id, tx) => {
      calls.push(tx ? 'find in tx' : 'find');
      return Promise.resolve(stored ?? undefined);
    }),
    findByUser: mock.fn<(userId: string, statuses: MatchStatus[]) => Promise<MatchRecord[]>>(() =>
      Promise.resolve(stored ? [stored] : []),
    ),
    lockEvent: mock.fn<(eventId: string, tx: Transaction) => Promise<void>>(() => {
      calls.push('lock');
      return Promise.resolve();
    }),
    setStatus: mock.fn<(id: string, from: MatchStatus, to: MatchStatus, tx: Transaction) => Promise<void>>(() =>
      Promise.resolve(),
    ),
    decline: mock.fn<(match: MatchRecord, userId: string, tx: Transaction) => Promise<void>>(() => Promise.resolve()),
  };
  const eventSessionsService = { getByIds: mock.fn(() => Promise.resolve(SESSIONS)) };
  const profilesService = {
    getPublicProfiles: mock.fn<(accountIds: string[]) => Promise<Map<string, PublicProfile>>>(() =>
      Promise.resolve(new Map([[OTHER_ACCOUNT_ID, OTHER_PROFILE]])),
    ),
    getContacts: mock.fn<(accountId: string) => Promise<Contacts>>(() => Promise.resolve(CONTACTS)),
    hasAcknowledgedSafetyNotice: mock.fn<(accountId: string) => Promise<boolean>>(() => Promise.resolve(true)),
  };
  const transactions = { run: mock.fn((work: (tx: Transaction) => Promise<unknown>) => work(TX)) };
  const service = new MatchesService(
    matchesRepository as unknown as MatchesRepository,
    eventSessionsService as unknown as EventSessionsService,
    profilesService as unknown as ProfilesService,
    transactions as unknown as TransactionRunner,
  );
  return { service, calls, matchesRepository, profilesService };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('MatchesService.listMine', () => {
  useFixedClock();

  // FR-019, UC-001 step 8
  test('shows the other’s public profile and answers, and the days the two share', async () => {
    const { service, matchesRepository } = makeService();

    const [match] = await service.listMine(ACCOUNT_ID);

    assert.deepEqual(matchesRepository.findByUser.mock.calls[0]?.arguments, [
      ACCOUNT_ID,
      ['proposed', 'accepted_a', 'accepted_b', 'mutual'],
    ]);
    const { accountId: _accountId, ...profile } = OTHER_PROFILE;
    assert.deepEqual(match, {
      id: 'match-1',
      eventId: EVENT_ID,
      applicationId: 'application-a',
      status: 'proposed',
      days: [{ startsAt: '2026-10-26T17:00:00.000Z', cutoffAt: '2026-10-26T16:00:00.000Z' }],
      validUntil: '2026-10-16T09:00:00.000Z',
      partner: { ...profile, desiredCompany: 'company', afterEventPlans: ['walk'] },
      createdAt: NOW.toISOString(),
    });
  });

  test('shows the match to the other participant from their side', async () => {
    const { service, profilesService } = makeService(aMatch({ status: 'accepted_a' }));
    profilesService.getPublicProfiles.mock.mockImplementation(() =>
      Promise.resolve(new Map([[ACCOUNT_ID, { ...OTHER_PROFILE, accountId: ACCOUNT_ID }]])),
    );

    const [match] = await service.listMine(OTHER_ACCOUNT_ID);

    assert.equal(match?.applicationId, 'application-b');
    // The caller's acceptance is hidden from the other until both accepted.
    assert.equal(match?.status, 'proposed');
  });
});

describe('MatchesService.getOwn', () => {
  useFixedClock();

  test('reports a match the caller takes no part in as missing', async () => {
    const { service } = makeService();

    await assert.rejects(service.getOwn(STRANGER_ID, 'match-1'), isDomainError('NOT_FOUND'));
  });

  test('reports an unknown match as missing', async () => {
    const { service } = makeService(null);

    await assert.rejects(service.getOwn(ACCOUNT_ID, 'match-1'), isDomainError('NOT_FOUND'));
  });
});

// UC-001 steps 9–11
describe('MatchesService.accept', () => {
  useFixedClock();

  test('accepts for the caller’s side under the event lock, reading the match again inside it', async () => {
    const { service, calls, matchesRepository } = makeService();

    const match = await service.accept(ACCOUNT_ID, 'match-1');

    assert.deepEqual(calls, ['find', 'lock', 'find in tx']);
    assert.deepEqual(matchesRepository.lockEvent.mock.calls[0]?.arguments, [EVENT_ID, TX]);
    assert.deepEqual(matchesRepository.setStatus.mock.calls[0]?.arguments, ['match-1', 'proposed', 'accepted_a', TX]);
    assert.equal(match.status, 'accepted');
  });

  test('makes the match mutual when the other has accepted', async () => {
    const { service, matchesRepository } = makeService(aMatch({ status: 'accepted_b' }));

    const match = await service.accept(ACCOUNT_ID, 'match-1');

    assert.deepEqual(matchesRepository.setStatus.mock.calls[0]?.arguments, ['match-1', 'accepted_b', 'mutual', TX]);
    assert.equal(match.status, 'mutual');
  });

  for (const status of ['accepted_a', 'mutual'] as const) {
    test(`changes nothing when the caller already accepted (${status})`, async () => {
      const { service, matchesRepository } = makeService(aMatch({ status }));

      await service.accept(ACCOUNT_ID, 'match-1');

      assert.equal(matchesRepository.setStatus.mock.callCount(), 0);
    });
  }

  for (const { title, match } of [
    { title: 'a declined proposal', match: aMatch({ status: 'declined' }) },
    { title: 'a cancelled proposal', match: aMatch({ status: 'cancelled' }) },
    { title: 'a proposal past its valid_until', match: aMatch({ validUntil: '2026-10-15T08:00:00.000Z' }) },
  ]) {
    test(`refuses ${title}`, async () => {
      const { service, matchesRepository } = makeService(match);

      await assert.rejects(service.accept(ACCOUNT_ID, 'match-1'), isDomainError('CONFLICT'));
      assert.equal(matchesRepository.setStatus.mock.callCount(), 0);
    });
  }

  test('reports a match the caller takes no part in as missing', async () => {
    const { service } = makeService();

    await assert.rejects(service.accept(STRANGER_ID, 'match-1'), isDomainError('NOT_FOUND'));
  });
});

// UC-001 A3, matching.md rule 5
describe('MatchesService.decline', () => {
  useFixedClock();

  for (const status of ['proposed', 'accepted_a', 'accepted_b'] as const) {
    test(`declines a ${status} proposal under the event lock`, async () => {
      const stored = aMatch({ status });
      const { service, calls, matchesRepository } = makeService(stored);

      const match = await service.decline(ACCOUNT_ID, 'match-1');

      assert.deepEqual(calls, ['find', 'lock', 'find in tx']);
      assert.deepEqual(matchesRepository.decline.mock.calls[0]?.arguments, [stored, ACCOUNT_ID, TX]);
      assert.equal(match.status, 'declined');
    });
  }

  test('changes nothing for a declined match', async () => {
    const { service, matchesRepository } = makeService(aMatch({ status: 'declined' }));

    const match = await service.decline(ACCOUNT_ID, 'match-1');

    assert.equal(match.status, 'declined');
    assert.equal(matchesRepository.decline.mock.callCount(), 0);
  });

  for (const { title, match } of [
    { title: 'a mutual match', match: aMatch({ status: 'mutual' }) },
    { title: 'a cancelled proposal', match: aMatch({ status: 'cancelled' }) },
    { title: 'a proposal past its valid_until', match: aMatch({ validUntil: '2026-10-15T08:00:00.000Z' }) },
  ]) {
    test(`refuses ${title}`, async () => {
      const { service, matchesRepository } = makeService(match);

      await assert.rejects(service.decline(ACCOUNT_ID, 'match-1'), isDomainError('CONFLICT'));
      assert.equal(matchesRepository.decline.mock.callCount(), 0);
    });
  }
});

// FR-019, SEC-001
describe('MatchesService.getContacts', () => {
  test('gives the other participant’s contacts once the match is mutual', async () => {
    const { service, profilesService } = makeService(aMatch({ status: 'mutual' }));

    const contacts = await service.getContacts(ACCOUNT_ID, 'match-1');

    assert.deepEqual(profilesService.getContacts.mock.calls[0]?.arguments, [OTHER_ACCOUNT_ID]);
    assert.deepEqual(contacts, CONTACTS);
  });

  for (const status of ['proposed', 'accepted_a', 'accepted_b', 'declined', 'cancelled'] as const) {
    test(`reports a ${status} match as missing`, async () => {
      const { service, profilesService } = makeService(aMatch({ status }));

      await assert.rejects(service.getContacts(ACCOUNT_ID, 'match-1'), isDomainError('NOT_FOUND'));
      assert.equal(profilesService.getContacts.mock.callCount(), 0);
    });
  }

  test('reports a mutual match of others as missing', async () => {
    const { service } = makeService(aMatch({ status: 'mutual' }));

    await assert.rejects(service.getContacts(STRANGER_ID, 'match-1'), isDomainError('NOT_FOUND'));
  });

  // SAFE-002
  test('holds the contacts back until the caller has acknowledged the safety notice', async () => {
    const { service, profilesService } = makeService(aMatch({ status: 'mutual' }));
    profilesService.hasAcknowledgedSafetyNotice.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.getContacts(ACCOUNT_ID, 'match-1'), isDomainError('SAFETY_NOTICE_REQUIRED'));
    assert.deepEqual(profilesService.hasAcknowledgedSafetyNotice.mock.calls[0]?.arguments, [ACCOUNT_ID]);
    assert.equal(profilesService.getContacts.mock.callCount(), 0);
  });

  test('reports a match that is not mutual as missing, whether or not the notice was acknowledged', async () => {
    const { service, profilesService } = makeService(aMatch({ status: 'accepted_a' }));
    profilesService.hasAcknowledgedSafetyNotice.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.getContacts(ACCOUNT_ID, 'match-1'), isDomainError('NOT_FOUND'));
  });
});
