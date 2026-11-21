// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { EventSessionsService } from '../../dist/core/catalog/services/event-sessions.service.js';
import type { EventSession, OpenedSession } from '../../dist/core/catalog/types/event-session.js';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { JobQueue } from '../../dist/core/jobs/adapters/job-queue.js';
import type { Job, JobHandler } from '../../dist/core/jobs/types/job.js';
import type { ApplicationsRepository } from '../../dist/core/matching/repositories/applications.repository.js';
import type { MatchesRepository } from '../../dist/core/matching/repositories/matches.repository.js';
import { MatchingService } from '../../dist/core/matching/services/matching.service.js';
import type { Application, ApplicationStatus } from '../../dist/core/matching/types/application.js';
import type { Match, MatchRecord, MatchStatus, NewMatch } from '../../dist/core/matching/types/match.js';
import type { ModerationService } from '../../dist/core/moderation/services/moderation.service.js';
import type { MatchingExclusions } from '../../dist/core/moderation/types/report.js';
import type { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { NotificationPayload, NotificationType } from '../../dist/core/notifications/types/notification.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { Interest, MatchingTraits } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { EVENT_ID } from './fixtures/catalog.ts';
import { NOW, useFixedClock } from './fixtures/clock.ts';

const TX = {} as Transaction;
const THIRD_ACCOUNT_ID = 'a0000000-0000-4000-8000-000000000003';
const SESSION_ID = '5e000000-0000-4000-8000-000000000001';
const LATER_SESSION_ID = '5e000000-0000-4000-8000-000000000002';
const JAZZ: Interest = { id: 'f0000000-0000-4000-8000-000000000002', name: 'Джаз', group: 'Музика' };

/** Ten days after NOW: rounds on 18 Oct 17:00, 22 Oct 17:00, 24 Oct 17:00 and 25 Oct 11:00. */
const SESSION: EventSession = {
  id: SESSION_ID,
  eventId: EVENT_ID,
  startsAt: '2026-10-25T17:00:00.000Z',
  cutoffAt: '2026-10-25T16:00:00.000Z',
  status: 'scheduled',
};
const LATER_SESSION: EventSession = {
  ...SESSION,
  id: LATER_SESSION_ID,
  startsAt: '2026-10-26T17:00:00.000Z',
  cutoffAt: '2026-10-26T16:00:00.000Z',
};
const OPEN_SESSION_ID = '5e000000-0000-4000-8000-000000000003';
/** Starts 4 hours after NOW: past its last round (T-6h), before its cutoff an hour before the start. */
const OPEN_SESSION: EventSession = {
  ...SESSION,
  id: OPEN_SESSION_ID,
  startsAt: '2026-10-15T13:00:00.000Z',
  cutoffAt: '2026-10-15T12:00:00.000Z',
};
const CLOSED_SESSION_ID = '5e000000-0000-4000-8000-000000000004';
/** Its cutoff passed an hour before NOW. */
const CLOSED_SESSION: EventSession = {
  ...SESSION,
  id: CLOSED_SESSION_ID,
  startsAt: '2026-10-15T09:00:00.000Z',
  cutoffAt: '2026-10-15T08:00:00.000Z',
};
const ALL_SESSIONS = [SESSION, LATER_SESSION, OPEN_SESSION, CLOSED_SESSION];

function anApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: `application-of-${overrides.userId ?? ACCOUNT_ID}`,
    userId: ACCOUNT_ID,
    eventId: EVENT_ID,
    sessionIds: [SESSION_ID],
    desiredCompany: 'company',
    afterEventPlans: [],
    preferredGender: 'any',
    ageMin: 18,
    ageMax: null,
    status: 'in_pool',
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

const NEWCOMER = anApplication();
const WAITING = anApplication({ userId: OTHER_ACCOUNT_ID });
/** Another kind of company and other plans than NEWCOMER: 0.7, too little for an instant match. */
const WEAKER = { desiredCompany: 'friends', afterEventPlans: ['walk'] } as const;

/** The pool is `pool`; every user in it likes jazz, is a 25-year-old woman unless `traits` says otherwise, and nobody
 * is excluded. */
function makeService({
  pool = [NEWCOMER, WAITING],
  traits = () => ({ interests: [JAZZ], gender: 'female', age: 25 }),
  stored = pool,
}: { pool?: Application[]; traits?: (userId: string) => MatchingTraits; stored?: Application[] } = {}) {
  const calls: string[] = [];
  const matchesRepository = {
    count: mock.fn(() => Promise.resolve(3)),
    lockEvent: mock.fn<(eventId: string, tx: Transaction) => Promise<void>>(() => {
      calls.push('lock');
      return Promise.resolve();
    }),
    findExcludedPairs: mock.fn<(eventId: string, tx: Transaction) => Promise<[string, string][]>>(() =>
      Promise.resolve([]),
    ),
    findByApplication: mock.fn<
      (applicationId: string, statuses: MatchStatus[], tx: Transaction) => Promise<MatchRecord | undefined>
    >(() => Promise.resolve(undefined)),
    cancelForWithdrawal: mock.fn<(match: MatchRecord, applicationId: string, tx: Transaction) => Promise<void>>(() => {
      calls.push('cancel');
      return Promise.resolve();
    }),
    propose: mock.fn<(match: NewMatch, tx: Transaction) => Promise<Match>>((match) =>
      Promise.resolve({
        ...match,
        id: 'match-1',
        status: 'proposed',
        validUntil: match.validUntil.toISOString(),
        createdAt: NOW.toISOString(),
      }),
    ),
  };
  const applicationsRepository = {
    findPool: mock.fn<(sessionIds: string[], tx: Transaction) => Promise<Application[]>>(() => {
      calls.push('pool');
      return Promise.resolve(pool);
    }),
    findById: mock.fn<(id: string, tx?: Transaction) => Promise<Application | undefined>>((id, tx) => {
      calls.push(tx ? 'find in tx' : 'find');
      return Promise.resolve(stored.find((application) => application.id === id));
    }),
    markNoMatch: mock.fn<(ids: string[], tx: Transaction) => Promise<void>>(() => {
      calls.push('no match');
      return Promise.resolve();
    }),
    withdraw: mock.fn<(id: string, from: ApplicationStatus[], tx: Transaction) => Promise<Application | undefined>>(
      (id) => {
        calls.push('withdraw');
        return Promise.resolve(anApplication({ id, status: 'withdrawn' }));
      },
    ),
  };
  const eventSessionsService = {
    getByIds: mock.fn<(ids: string[], tx?: Transaction) => Promise<Map<string, EventSession>>>(() =>
      Promise.resolve(new Map(ALL_SESSIONS.map((session) => [session.id, session]))),
    ),
  };
  const profilesService = {
    getMatchingTraits: mock.fn<
      (userIds: string[], day: string, tx?: Transaction) => Promise<Map<string, MatchingTraits>>
    >((userIds) =>
      Promise.resolve(new Map(userIds.map((userId): [string, MatchingTraits] => [userId, traits(userId)]))),
    ),
  };
  const moderationService = {
    exclusionsFor: mock.fn((): Promise<MatchingExclusions> => Promise.resolve({ reported: [], banned: [] })),
  };
  const notificationsService = {
    notify: mock.fn<
      (
        accountId: string,
        type: NotificationType,
        payload: NotificationPayload,
        dedupeKey: string,
        tx: Transaction,
      ) => Promise<undefined>
    >(() => Promise.resolve(undefined)),
  };
  const transactions = { run: mock.fn((work: (tx: Transaction) => Promise<unknown>) => work(TX)) };
  const jobs = {
    enqueue: mock.fn<(name: string, payload: object, options?: object, tx?: Transaction) => Promise<void>>(() =>
      Promise.resolve(),
    ),
    register: mock.fn<(name: string, handler: JobHandler<{ sessionId: string }>) => void>(),
  };
  const service = new MatchingService(
    matchesRepository as unknown as MatchesRepository,
    applicationsRepository as unknown as ApplicationsRepository,
    eventSessionsService as unknown as EventSessionsService,
    profilesService as unknown as ProfilesService,
    moderationService as unknown as ModerationService,
    notificationsService as unknown as NotificationsService,
    transactions as unknown as TransactionRunner,
    jobs as unknown as JobQueue,
  );
  return {
    service,
    calls,
    matchesRepository,
    applicationsRepository,
    eventSessionsService,
    profilesService,
    moderationService,
    notificationsService,
    transactions,
    jobs,
  };
}

describe('MatchingService.onModuleInit', () => {
  test('handles the matching.round job by running the round of its session', async () => {
    const { service, jobs, eventSessionsService } = makeService();

    service.onModuleInit();
    const [name, handler] = jobs.register.mock.calls[0]?.arguments ?? [];
    const job: Job<{ sessionId: string }> = { id: 'job-1', name: 'matching.round', payload: { sessionId: SESSION_ID } };
    await handler?.(job);

    assert.equal(name, 'matching.round');
    assert.deepEqual(eventSessionsService.getByIds.mock.calls[0]?.arguments, [[SESSION_ID]]);
  });

  test('handles the matching.cutoff job by closing its session', async () => {
    const { service, jobs, eventSessionsService } = makeService();

    service.onModuleInit();
    const [name, handler] = jobs.register.mock.calls[1]?.arguments ?? [];
    await handler?.({ id: 'job-2', name: 'matching.cutoff', payload: { sessionId: CLOSED_SESSION_ID } });

    assert.equal(name, 'matching.cutoff');
    assert.deepEqual(eventSessionsService.getByIds.mock.calls[0]?.arguments, [[CLOSED_SESSION_ID]]);
  });
});

// matching.md, rules 2 and 3
describe('MatchingService.scheduleRounds', () => {
  useFixedClock();

  test('plans every round still to come of a new session and its cutoff at their time, in the transaction', async () => {
    const { service, jobs } = makeService();

    await service.scheduleRounds([{ ...SESSION, created: true }], TX);

    assert.deepEqual(
      jobs.enqueue.mock.calls.map(({ arguments: args }) => args),
      [
        ...[
          '2026-10-18T17:00:00.000Z',
          '2026-10-22T17:00:00.000Z',
          '2026-10-24T17:00:00.000Z',
          '2026-10-25T11:00:00.000Z',
        ].map((runAt) => ['matching.round', { sessionId: SESSION_ID }, { runAt: new Date(runAt) }, TX]),
        ['matching.cutoff', { sessionId: SESSION_ID }, { runAt: new Date(SESSION.cutoffAt) }, TX],
      ],
    );
  });

  test('skips the rounds already past', async () => {
    const { service, jobs } = makeService();
    // Starts in 2 days: the rounds a week and 3 days before are past.
    const soon: OpenedSession = { ...SESSION, startsAt: '2026-10-17T09:00:00.000Z', created: true };

    await service.scheduleRounds([soon], TX);

    assert.deepEqual(
      jobs.enqueue.mock.calls.map(({ arguments: [name] }) => name),
      ['matching.round', 'matching.round', 'matching.cutoff'],
    );
  });

  test('plans only the cutoff of a session past its last round', async () => {
    const { service, jobs } = makeService();

    await service.scheduleRounds([{ ...OPEN_SESSION, created: true }], TX);

    assert.deepEqual(
      jobs.enqueue.mock.calls.map(({ arguments: args }) => args),
      [['matching.cutoff', { sessionId: OPEN_SESSION_ID }, { runAt: new Date(OPEN_SESSION.cutoffAt) }, TX]],
    );
  });

  test('plans nothing for a session another application created', async () => {
    const { service, jobs } = makeService();

    await service.scheduleRounds([{ ...SESSION, created: false }], TX);

    assert.equal(jobs.enqueue.mock.callCount(), 0);
  });
});

// matching.md, rule 1
describe('MatchingService.matchOnApply', () => {
  useFixedClock();

  test('takes the event lock before it reads the pool', async () => {
    const { service, calls, matchesRepository } = makeService();

    await service.matchOnApply(NEWCOMER);

    assert.deepEqual(calls, ['lock', 'pool']);
    assert.deepEqual(matchesRepository.lockEvent.mock.calls[0]?.arguments, [EVENT_ID, TX]);
  });

  test('proposes an exceptionally good partner at once, valid for 24 hours when no round comes sooner', async () => {
    const { service, matchesRepository } = makeService();

    const proposed = await service.matchOnApply(NEWCOMER);

    const [match, tx] = matchesRepository.propose.mock.calls[0]?.arguments ?? [];
    assert.equal(proposed, true);
    assert.equal(tx, TX);
    assert.equal(match?.applicationAId, NEWCOMER.id);
    assert.equal(match?.applicationBId, WAITING.id);
    assert.equal(match?.source, 'instant');
    assert.equal(match?.score, 1);
    assert.equal(match?.validUntil.toISOString(), '2026-10-16T09:00:00.000Z');
  });

  // matching.md, rule 4; HLD I3
  test('plans the expiry of the proposal at its valid_until, in the transaction', async () => {
    const { service, jobs } = makeService();

    await service.matchOnApply(NEWCOMER);

    assert.deepEqual(
      jobs.enqueue.mock.calls.map(({ arguments: args }) => args),
      [['matching.expire', { matchId: 'match-1' }, { runAt: new Date('2026-10-16T09:00:00.000Z') }, TX]],
    );
  });

  // Inside the transaction, so the step holding the lock needs no second connection.
  test('reads the profiles and the days of the pool in the transaction of the lock', async () => {
    const { service, profilesService, eventSessionsService } = makeService();

    await service.matchOnApply(NEWCOMER);

    assert.equal(profilesService.getMatchingTraits.mock.calls[0]?.arguments[2], TX);
    assert.equal(eventSessionsService.getByIds.mock.calls[0]?.arguments[1], TX);
  });

  test('takes the ages on the Kyiv day of the first day the application waits on', async () => {
    const { service, profilesService } = makeService();

    await service.matchOnApply(anApplication({ sessionIds: [LATER_SESSION_ID, SESSION_ID] }));

    assert.equal(profilesService.getMatchingTraits.mock.calls[0]?.arguments[1], '2026-10-25');
  });

  // matching.md, policy: whom each wants to go with
  test('proposes nothing when the partner is not whom the newcomer wants to go with', async () => {
    const newcomer = anApplication({ preferredGender: 'male' });
    const { service, matchesRepository } = makeService({
      pool: [newcomer, WAITING],
      traits: (userId) => ({ interests: [JAZZ], gender: userId === ACCOUNT_ID ? 'male' : 'female', age: 25 }),
    });

    const proposed = await service.matchOnApply(newcomer);

    assert.equal(proposed, false);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('proposes nothing when the newcomer is outside the age range the partner asked for', async () => {
    const { service, matchesRepository } = makeService({
      pool: [NEWCOMER, anApplication({ userId: OTHER_ACCOUNT_ID, ageMin: 30, ageMax: 40 })],
    });

    const proposed = await service.matchOnApply(NEWCOMER);

    assert.equal(proposed, false);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('reads the pool of every day the application waits on', async () => {
    const { service, applicationsRepository } = makeService();

    await service.matchOnApply(anApplication({ sessionIds: [SESSION_ID, LATER_SESSION_ID] }));

    assert.deepEqual(applicationsRepository.findPool.mock.calls[0]?.arguments, [[SESSION_ID, LATER_SESSION_ID], TX]);
  });

  test('proposes nothing without a good enough partner', async () => {
    const { service, matchesRepository } = makeService({
      pool: [
        NEWCOMER,
        anApplication({ userId: OTHER_ACCOUNT_ID, desiredCompany: 'friends', afterEventPlans: ['walk'] }),
      ],
    });

    const proposed = await service.matchOnApply(NEWCOMER);

    assert.equal(proposed, false);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('proposes nothing when the application left the pool before the lock', async () => {
    const { service, matchesRepository } = makeService({ pool: [WAITING] });

    const proposed = await service.matchOnApply(NEWCOMER);

    assert.equal(proposed, false);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  // FR-020
  test('keeps apart users one of whom reported the other', async () => {
    const { service, moderationService, matchesRepository } = makeService();
    moderationService.exclusionsFor.mock.mockImplementation(() =>
      Promise.resolve({ reported: [[OTHER_ACCOUNT_ID, ACCOUNT_ID]], banned: [] }),
    );

    await service.matchOnApply(NEWCOMER);

    assert.deepEqual(moderationService.exclusionsFor.mock.calls[0]?.arguments, [[ACCOUNT_ID, OTHER_ACCOUNT_ID], TX]);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  // FR-020, matching.md rule 5
  test('keeps apart users whose proposal at this event was declined', async () => {
    const { service, matchesRepository } = makeService();
    matchesRepository.findExcludedPairs.mock.mockImplementation(() =>
      Promise.resolve([[ACCOUNT_ID, OTHER_ACCOUNT_ID]]),
    );

    await service.matchOnApply(NEWCOMER);

    assert.deepEqual(matchesRepository.findExcludedPairs.mock.calls[0]?.arguments, [EVENT_ID, TX]);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  // FR-020
  test('leaves a banned user out of the pool', async () => {
    const { service, moderationService, matchesRepository } = makeService();
    moderationService.exclusionsFor.mock.mockImplementation(() =>
      Promise.resolve({ reported: [], banned: [OTHER_ACCOUNT_ID] }),
    );

    await service.matchOnApply(NEWCOMER);

    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('leaves out a user without a profile', async () => {
    const { service, profilesService, matchesRepository } = makeService();
    profilesService.getMatchingTraits.mock.mockImplementation(() =>
      Promise.resolve(new Map([[ACCOUNT_ID, { interests: [JAZZ], gender: 'female' as const, age: 25 }]])),
    );

    await service.matchOnApply(NEWCOMER);

    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('leaves out the days past their cutoff or cancelled', async () => {
    const closed = { ...LATER_SESSION, cutoffAt: '2026-10-15T08:00:00.000Z' };
    const cancelled = { ...SESSION, status: 'cancelled' as const };
    const { service, eventSessionsService, matchesRepository } = makeService();
    eventSessionsService.getByIds.mock.mockImplementation(() =>
      Promise.resolve(
        new Map([
          [SESSION_ID, cancelled],
          [LATER_SESSION_ID, closed],
        ]),
      ),
    );

    await service.matchOnApply(anApplication({ sessionIds: [SESSION_ID, LATER_SESSION_ID] }));

    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });
});

// matching.md, rule 7
describe('MatchingService.withdraw', () => {
  useFixedClock();

  test('withdraws the application under the event lock', async () => {
    const { service, calls, applicationsRepository } = makeService();

    const withdrawn = await service.withdraw(NEWCOMER, ['in_pool', 'paused']);

    assert.deepEqual(calls, ['lock', 'withdraw']);
    assert.deepEqual(applicationsRepository.withdraw.mock.calls[0]?.arguments, [
      NEWCOMER.id,
      ['in_pool', 'paused'],
      TX,
    ]);
    assert.equal(withdrawn?.status, 'withdrawn');
  });

  // UC-001 A5
  for (const status of ['proposed', 'accepted_a', 'accepted_b'] as const) {
    test(`cancels a ${status} proposal of the application before withdrawing it`, async () => {
      const { service, calls, matchesRepository } = makeService();
      const match = aMatchRecord(status);
      matchesRepository.findByApplication.mock.mockImplementation(() => Promise.resolve(match));

      await service.withdraw({ ...NEWCOMER, status: 'paired' }, ['in_pool', 'paused', 'paired']);

      assert.deepEqual(matchesRepository.findByApplication.mock.calls[0]?.arguments, [
        NEWCOMER.id,
        ['proposed', 'accepted_a', 'accepted_b', 'mutual'],
        TX,
      ]);
      assert.deepEqual(matchesRepository.cancelForWithdrawal.mock.calls[0]?.arguments, [match, NEWCOMER.id, TX]);
      assert.deepEqual(calls.slice(0, 3), ['lock', 'cancel', 'withdraw']);
    });
  }

  test('matches the other application of a cancelled proposal again once the withdrawal commits', async () => {
    const { service, calls, matchesRepository, applicationsRepository } = makeService();
    matchesRepository.findByApplication.mock.mockImplementation(() => Promise.resolve(aMatchRecord('proposed')));

    await service.withdraw({ ...NEWCOMER, status: 'paired' }, ['in_pool', 'paused', 'paired']);

    assert.deepEqual(calls.slice(0, 4), ['lock', 'cancel', 'withdraw', 'find']);
    assert.equal(applicationsRepository.findById.mock.calls[0]?.arguments[0], WAITING.id);
  });

  test('keeps an application with a mutual match', async () => {
    const { service, matchesRepository, applicationsRepository } = makeService();
    matchesRepository.findByApplication.mock.mockImplementation(() => Promise.resolve(aMatchRecord('mutual')));

    await assert.rejects(
      service.withdraw({ ...NEWCOMER, status: 'paired' }, ['in_pool', 'paused', 'paired']),
      (error: unknown) => error instanceof DomainError && error.code === 'CONFLICT',
    );
    assert.equal(matchesRepository.cancelForWithdrawal.mock.callCount(), 0);
    assert.equal(applicationsRepository.withdraw.mock.callCount(), 0);
  });
});

// matching.md, rule 3
describe('MatchingService.matchOnApply in open mode', () => {
  useFixedClock();

  const onOpenDay = (overrides: Partial<Application> = {}) =>
    anApplication({ sessionIds: [OPEN_SESSION_ID], ...overrides });

  test('proposes the best partner past the last round, however low the score, until the cutoff', async () => {
    const newcomer = onOpenDay();
    const { service, matchesRepository, jobs } = makeService({
      pool: [onOpenDay({ userId: OTHER_ACCOUNT_ID, ...WEAKER }), newcomer],
    });

    const proposed = await service.matchOnApply(newcomer);

    const [match] = matchesRepository.propose.mock.calls[0]?.arguments ?? [];
    assert.equal(proposed, true);
    assert.equal(match?.source, 'open');
    assert.equal(match?.score, 0.7);
    assert.equal(match?.applicationAId, newcomer.id);
    assert.equal(match?.validUntil.toISOString(), OPEN_SESSION.cutoffAt);
    assert.deepEqual(jobs.enqueue.mock.calls[0]?.arguments, [
      'matching.expire',
      { matchId: 'match-1' },
      { runAt: new Date(OPEN_SESSION.cutoffAt) },
      TX,
    ]);
  });

  test('of equal scores, proposes whoever has waited longest', async () => {
    const newcomer = onOpenDay();
    const longest = onOpenDay({ userId: THIRD_ACCOUNT_ID });
    // The pool comes oldest application first.
    const { service, matchesRepository } = makeService({
      pool: [longest, onOpenDay({ userId: OTHER_ACCOUNT_ID }), newcomer],
    });

    await service.matchOnApply(newcomer);

    assert.equal(matchesRepository.propose.mock.calls[0]?.arguments[0].applicationBId, longest.id);
  });

  test('pairs in open mode only with users waiting on a day past its last round', async () => {
    const newcomer = onOpenDay({ sessionIds: [OPEN_SESSION_ID, SESSION_ID] });
    const { service, matchesRepository } = makeService({
      pool: [anApplication({ userId: OTHER_ACCOUNT_ID, ...WEAKER }), newcomer],
    });

    const proposed = await service.matchOnApply(newcomer);

    assert.equal(proposed, false);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('falls back to an instant match on the days whose rounds are still to come', async () => {
    const newcomer = onOpenDay({ sessionIds: [OPEN_SESSION_ID, SESSION_ID] });
    const { service, matchesRepository } = makeService({ pool: [WAITING, newcomer] });

    await service.matchOnApply(newcomer);

    assert.equal(matchesRepository.propose.mock.calls[0]?.arguments[0].source, 'instant');
  });

  // FR-020
  test('never proposes a user kept apart from the newcomer', async () => {
    const newcomer = onOpenDay();
    const { service, matchesRepository } = makeService({ pool: [onOpenDay({ userId: OTHER_ACCOUNT_ID }), newcomer] });
    matchesRepository.findExcludedPairs.mock.mockImplementation(() =>
      Promise.resolve([[OTHER_ACCOUNT_ID, ACCOUNT_ID]]),
    );

    assert.equal(await service.matchOnApply(newcomer), false);
  });

  test('proposes nothing when nobody else waits', async () => {
    const newcomer = onOpenDay();
    const { service, matchesRepository } = makeService({ pool: [newcomer] });

    assert.equal(await service.matchOnApply(newcomer), false);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });
});

// matching.md, rules 3 and 5; FR-018
describe('MatchingService.matchReturned', () => {
  useFixedClock();

  const returned = anApplication({ sessionIds: [OPEN_SESSION_ID] });
  const waiting = anApplication({ userId: OTHER_ACCOUNT_ID, sessionIds: [OPEN_SESSION_ID] });

  test('takes the event lock before it reads the application again, then matches it in open mode', async () => {
    const { service, calls, matchesRepository } = makeService({ pool: [waiting, returned] });

    await service.matchReturned([returned.id]);

    assert.deepEqual(calls, ['find', 'lock', 'find in tx', 'pool']);
    const [match] = matchesRepository.propose.mock.calls[0]?.arguments ?? [];
    assert.equal(match?.source, 'open');
    assert.equal(match?.applicationAId, returned.id);
  });

  test('leaves an application whose rounds are still to come for the next round', async () => {
    const { service, matchesRepository } = makeService({ pool: [WAITING, NEWCOMER] });

    await service.matchReturned([NEWCOMER.id]);

    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('does nothing for an application that left the pool meanwhile', async () => {
    const { service, transactions, applicationsRepository } = makeService({
      pool: [waiting],
      stored: [{ ...returned, status: 'paired' }],
    });

    await service.matchReturned([returned.id]);

    assert.equal(transactions.run.mock.callCount(), 1);
    assert.equal(applicationsRepository.findPool.mock.callCount(), 0);
  });

  test('ends an application with no open day left with no match, and tells its user', async () => {
    const late = anApplication({ sessionIds: [CLOSED_SESSION_ID] });
    const { service, applicationsRepository, notificationsService, matchesRepository } = makeService({
      pool: [late],
    });

    await service.matchReturned([late.id]);

    assert.deepEqual(applicationsRepository.markNoMatch.mock.calls[0]?.arguments, [[late.id], TX]);
    assert.deepEqual(notificationsService.notify.mock.calls[0]?.arguments, [
      ACCOUNT_ID,
      'no_match_found',
      { applicationId: late.id, eventId: EVENT_ID },
      `no_match_found:${late.id}`,
      TX,
    ]);
    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('goes on with the next application when one fails', async () => {
    const { service, matchesRepository } = makeService({ pool: [waiting, returned] });
    matchesRepository.lockEvent.mock.mockImplementationOnce(() => Promise.reject(new Error('lock timeout')));

    await service.matchReturned([returned.id, returned.id]);

    assert.equal(matchesRepository.propose.mock.callCount(), 1);
  });
});

// FR-018, matching.md rule 3
describe('MatchingService.closeSession', () => {
  useFixedClock();

  test('ends with no match the applications that have no other open day, under the event lock', async () => {
    const onlyThisDay = anApplication({ sessionIds: [CLOSED_SESSION_ID] });
    const anotherDayLeft = anApplication({ userId: OTHER_ACCOUNT_ID, sessionIds: [CLOSED_SESSION_ID, SESSION_ID] });
    const { service, calls, applicationsRepository, notificationsService } = makeService({
      pool: [onlyThisDay, anotherDayLeft],
    });

    await service.closeSession(CLOSED_SESSION_ID);

    assert.deepEqual(calls, ['lock', 'pool', 'no match']);
    assert.deepEqual(applicationsRepository.findPool.mock.calls[0]?.arguments, [[CLOSED_SESSION_ID], TX]);
    assert.deepEqual(applicationsRepository.markNoMatch.mock.calls[0]?.arguments, [[onlyThisDay.id], TX]);
    assert.deepEqual(
      notificationsService.notify.mock.calls.map(({ arguments: [accountId, type] }) => [accountId, type]),
      [[ACCOUNT_ID, 'no_match_found']],
    );
  });

  test('changes nothing when nobody is left in the pool', async () => {
    const { service, applicationsRepository, notificationsService } = makeService({ pool: [] });

    await service.closeSession(CLOSED_SESSION_ID);

    assert.equal(applicationsRepository.markNoMatch.mock.callCount(), 0);
    assert.equal(notificationsService.notify.mock.callCount(), 0);
  });

  test('plans the job again at a cutoff that moved later', async () => {
    const { service, jobs, transactions } = makeService();

    await service.closeSession(OPEN_SESSION_ID);

    assert.deepEqual(jobs.enqueue.mock.calls[0]?.arguments, [
      'matching.cutoff',
      { sessionId: OPEN_SESSION_ID },
      { runAt: new Date(OPEN_SESSION.cutoffAt) },
    ]);
    assert.equal(transactions.run.mock.callCount(), 0);
  });

  for (const { title, session } of [
    { title: 'an unknown session', session: undefined },
    { title: 'a cancelled session', session: { ...CLOSED_SESSION, status: 'cancelled' as const } },
  ]) {
    test(`does nothing for ${title}`, async () => {
      const { service, eventSessionsService, transactions, jobs } = makeService();
      eventSessionsService.getByIds.mock.mockImplementation(() =>
        Promise.resolve(new Map(session ? [[CLOSED_SESSION_ID, session]] : [])),
      );

      await service.closeSession(CLOSED_SESSION_ID);

      assert.equal(transactions.run.mock.callCount(), 0);
      assert.equal(jobs.enqueue.mock.callCount(), 0);
    });
  }
});

function aMatchRecord(status: MatchStatus): MatchRecord {
  return {
    id: 'match-1',
    applicationAId: NEWCOMER.id,
    applicationBId: WAITING.id,
    source: 'round',
    score: 0.7,
    seed: 1,
    status,
    validUntil: '2026-10-16T09:00:00.000Z',
    createdAt: NOW.toISOString(),
    eventId: EVENT_ID,
    applicationA: { ...NEWCOMER, status: 'paired' },
    applicationB: { ...WAITING, status: 'paired' },
  };
}

// matching.md, rule 2
describe('MatchingService.runRound', () => {
  useFixedClock();

  test('pairs the pool of the session under the event lock and proposes each pair', async () => {
    const third = anApplication({ userId: THIRD_ACCOUNT_ID, desiredCompany: 'friends', afterEventPlans: ['walk'] });
    const fourth = anApplication({
      userId: 'a0000000-0000-4000-8000-000000000004',
      desiredCompany: 'friends',
      afterEventPlans: ['walk'],
    });
    const { service, calls, applicationsRepository, matchesRepository } = makeService({
      pool: [NEWCOMER, WAITING, third, fourth],
    });

    await service.runRound(SESSION_ID);

    assert.deepEqual(calls, ['lock', 'pool']);
    assert.deepEqual(applicationsRepository.findPool.mock.calls[0]?.arguments, [[SESSION_ID], TX]);
    const proposals = matchesRepository.propose.mock.calls.map(({ arguments: [match] }) => match);
    assert.deepEqual(
      proposals.map(({ applicationAId, applicationBId }) => [applicationAId, applicationBId].sort().join('+')).sort(),
      [
        [NEWCOMER.id, WAITING.id],
        [third.id, fourth.id],
      ]
        .map((pair) => pair.sort().join('+'))
        .sort(),
    );
    assert.ok(proposals.every(({ source }) => source === 'round'));
  });

  test('takes the ages on the Kyiv day of the session', async () => {
    const { service, profilesService } = makeService();

    await service.runRound(LATER_SESSION_ID);

    assert.equal(profilesService.getMatchingTraits.mock.calls[0]?.arguments[1], '2026-10-26');
  });

  // matching.md, policy: whom each wants to go with, mutually
  test('never proposes a pair where one is not whom the other wants to go with', async () => {
    const man = anApplication({ userId: THIRD_ACCOUNT_ID, preferredGender: 'female' });
    const { service, matchesRepository } = makeService({
      pool: [anApplication({ preferredGender: 'female' }), man],
      traits: (userId) => ({ interests: [JAZZ], gender: userId === THIRD_ACCOUNT_ID ? 'male' : 'female', age: 25 }),
    });

    await service.runRound(SESSION_ID);

    assert.equal(matchesRepository.propose.mock.callCount(), 0);
  });

  test('ends a proposal at the next round on a day the two share', async () => {
    const { service, matchesRepository } = makeService({
      pool: [NEWCOMER, anApplication({ userId: OTHER_ACCOUNT_ID, sessionIds: [SESSION_ID, LATER_SESSION_ID] })],
    });
    // A day before the first round of SESSION (18 Oct 17:00); LATER_SESSION is not shared.
    mock.timers.setTime(new Date('2026-10-18T02:00:00.000Z').getTime());

    await service.runRound(SESSION_ID);

    assert.equal(
      matchesRepository.propose.mock.calls[0]?.arguments[0].validUntil.toISOString(),
      '2026-10-18T17:00:00.000Z',
    );
  });

  for (const { title, session } of [
    { title: 'an unknown session', session: undefined },
    { title: 'a cancelled session', session: { ...SESSION, status: 'cancelled' as const } },
    { title: 'a session past its cutoff', session: { ...SESSION, cutoffAt: '2026-10-15T08:00:00.000Z' } },
  ]) {
    test(`does nothing for ${title}`, async () => {
      const { service, eventSessionsService, transactions } = makeService();
      eventSessionsService.getByIds.mock.mockImplementation(() =>
        Promise.resolve(new Map(session ? [[SESSION_ID, session]] : [])),
      );

      await service.runRound(SESSION_ID);

      assert.equal(transactions.run.mock.callCount(), 0);
    });
  }
});

describe('MatchingService.stats', () => {
  test('counts every match proposed', async () => {
    const { service } = makeService();

    assert.deepEqual(await service.stats(), { matches: 3 });
  });
});
