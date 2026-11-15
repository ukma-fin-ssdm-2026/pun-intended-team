// Written with the help of Claude
// The consumer of event.changed (matching.md, rule 10), over an event, its sessions, applications, proposals and the
// inbox kept in memory, so that running a job twice shows whether the second run changes anything.
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { Event } from '../../dist/core/catalog/types/event.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { JobQueue } from '../../dist/core/jobs/adapters/job-queue.js';
import type { ApplicationsRepository } from '../../dist/core/matching/repositories/applications.repository.js';
import type { MatchesRepository } from '../../dist/core/matching/repositories/matches.repository.js';
import { EventChangesService } from '../../dist/core/matching/services/event-changes.service.js';
import type { Application, ApplicationStatus } from '../../dist/core/matching/types/application.js';
import type { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { NewNotification } from '../../dist/core/notifications/types/notification.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { anEvent, EVENT_ID } from './fixtures/catalog.ts';
import { NOW, useFixedClock } from './fixtures/clock.ts';
import { sessionAt, sessionStates, sessionsServiceOver, type StoredSession } from './fixtures/event-sessions.ts';

const TX = { transaction: true } as unknown as Transaction;
const PENDING = ['proposed', 'accepted_a', 'accepted_b'];

interface StoredMatch {
  id: string;
  applicationAId: string;
  applicationBId: string;
  status: string;
  cancelReason?: string;
}

interface World {
  event: Event | undefined;
  sessions: StoredSession[];
  applications: Application[];
  matches: StoredMatch[];
  inbox: NewNotification[];
  locked?: boolean;
}

function anApplication(id: string, sessionIds: string[], status: ApplicationStatus = 'in_pool', userId = ACCOUNT_ID) {
  return {
    id,
    userId,
    eventId: EVENT_ID,
    sessionIds,
    desiredCompany: 'company' as const,
    afterEventPlans: [],
    status,
    createdAt: NOW.toISOString(),
  } satisfies Application;
}

/** The consumer over `world`; every repository call must come with the transaction. */
function makeService(world: World) {
  const inTransaction = (tx?: Transaction) => assert.equal(tx, TX, 'called outside the transaction');
  const applicationsRepository: Pick<ApplicationsRepository, 'findBySessions' | 'cancel' | 'removeDays' | 'moveDay'> = {
    findBySessions: (sessionIds, statuses, tx) => {
      inTransaction(tx);
      assert.ok(world.locked, 'applications are read only under the event lock');
      return Promise.resolve(
        world.applications
          .filter(
            ({ status, sessionIds: days }) => statuses.includes(status) && days.some((day) => sessionIds.includes(day)),
          )
          .map((application) => ({ ...application, sessionIds: [...application.sessionIds] })),
      );
    },
    cancel: (ids, from, tx) => {
      inTransaction(tx);
      for (const application of world.applications) {
        if (ids.includes(application.id) && from.includes(application.status)) {
          application.status = 'cancelled';
        }
      }
      return Promise.resolve();
    },
    removeDays: (ids, sessionIds, tx) => {
      inTransaction(tx);
      for (const application of world.applications.filter(({ id }) => ids.includes(id))) {
        application.sessionIds = application.sessionIds.filter((day) => !sessionIds.includes(day));
      }
      return Promise.resolve();
    },
    moveDay: (fromSessionId, toSessionId, tx) => {
      inTransaction(tx);
      for (const application of world.applications) {
        const days = application.sessionIds.map((day) => (day === fromSessionId ? toSessionId : day));
        application.sessionIds = [...new Set(days)];
      }
      return Promise.resolve();
    },
  };
  const matchesRepository: Pick<MatchesRepository, 'lockEvent' | 'cancelPending'> = {
    lockEvent: (eventId, tx) => {
      inTransaction(tx);
      assert.equal(eventId, EVENT_ID);
      world.locked = true;
      return Promise.resolve();
    },
    cancelPending: (applicationIds, reason, tx) => {
      inTransaction(tx);
      assert.ok(world.locked, 'proposals change only under the event lock');
      for (const match of world.matches) {
        const theirs = applicationIds.includes(match.applicationAId) || applicationIds.includes(match.applicationBId);
        if (theirs && PENDING.includes(match.status)) {
          Object.assign(match, { status: 'cancelled', cancelReason: reason });
          for (const other of world.applications) {
            const inMatch = other.id === match.applicationAId || other.id === match.applicationBId;
            if (inMatch && !applicationIds.includes(other.id) && other.status === 'paired') {
              other.status = 'in_pool';
            }
          }
        }
      }
      return Promise.resolve();
    },
  };
  const notificationsService: Pick<NotificationsService, 'notify'> = {
    notify: (notification, tx) => {
      inTransaction(tx);
      const told = world.inbox.some(({ dedupeKey }) => dedupeKey === notification.dedupeKey);
      if (!told) {
        world.inbox.push(notification);
      }
      return Promise.resolve(!told);
    },
  };
  const transactions: TransactionRunner = { run: (work) => work(TX) };
  const jobs = { register: mock.fn<JobQueue['register']>() };
  const service = new EventChangesService(
    jobs as unknown as JobQueue,
    transactions,
    sessionsServiceOver(world),
    applicationsRepository as ApplicationsRepository,
    matchesRepository as MatchesRepository,
    notificationsService as NotificationsService,
  );
  return { service, jobs };
}

/** Everything that is stored, as short lines. */
function stateOf(world: World) {
  return {
    sessions: sessionStates(world.sessions),
    applications: world.applications.map(({ id, status, sessionIds }) => `${id} ${status} ${sessionIds.join('+')}`),
    matches: world.matches.map(
      ({ id, status, cancelReason }) => `${id} ${status}${cancelReason ? ` ${cancelReason}` : ''}`,
    ),
    inbox: world.inbox.map(({ accountId, dedupeKey }) => `${accountId === ACCOUNT_ID ? 'user' : 'other'} ${dedupeKey}`),
  };
}

const iso = (kyivTime: string) => new Date(kyivTime).toISOString();

/** NOW is 12:00 in Kyiv on 15 October. */
const CONCERT = { startsAt: '2026-10-22T19:00:00+03:00', endsAt: '2026-10-22T21:00:00+03:00' };
const CONCERT_AT_20 = { startsAt: '2026-10-22T20:00:00+03:00', endsAt: '2026-10-22T22:00:00+03:00' };
/** A show at 19:00 every day from 14 to 30 October; Kyiv is on +02:00 from the 25th. */
const RUN = { startsAt: '2026-10-14T19:00:00+03:00', endsAt: '2026-10-30T21:00:00+02:00' };
const RUN_ON_18 = '2026-10-18T19:00:00+03:00';
const RUN_ON_27 = '2026-10-27T19:00:00+02:00';
const OPENING = '2026-10-14T17:00:00+03:00';
const EXHIBITION_RUN = { startsAt: '2026-10-15T12:00:00+03:00', endsAt: '2026-11-10T23:59:59+02:00' };

interface Case {
  name: string;
  change: 'cancelled' | 'republished' | 'rescheduled';
  world: Omit<World, 'inbox'> & { inbox?: NewNotification[] };
  after: ReturnType<typeof stateOf>;
}

const cases: Case[] = [
  {
    name: 'a cancelled event: its session, active applications and open proposals are cancelled, each applicant told once',
    change: 'cancelled',
    world: {
      event: anEvent({ ...CONCERT, status: 'cancelled' }),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: [
        anApplication('waiting', ['s1']),
        anApplication('paired', ['s1'], 'paired', OTHER_ACCOUNT_ID),
        anApplication('withdrawn', ['s1'], 'withdrawn', OTHER_ACCOUNT_ID),
      ],
      matches: [
        { id: 'proposed', applicationAId: 'waiting', applicationBId: 'paired', status: 'proposed' },
        { id: 'accepted', applicationAId: 'paired', applicationBId: 'waiting', status: 'accepted_a' },
        { id: 'mutual', applicationAId: 'waiting', applicationBId: 'paired', status: 'mutual' },
        { id: 'declined', applicationAId: 'waiting', applicationBId: 'paired', status: 'declined' },
      ],
    },
    after: {
      sessions: [`s1 cancelled ${iso(CONCERT.startsAt)}`],
      applications: ['waiting cancelled s1', 'paired cancelled s1', 'withdrawn withdrawn s1'],
      matches: [
        'proposed cancelled event_cancelled',
        'accepted cancelled event_cancelled',
        'mutual mutual',
        'declined declined',
      ],
      inbox: ['user event_changed:cancelled:waiting', 'other event_changed:cancelled:paired'],
    },
  },
  {
    name: 'an event published again: its session is scheduled again, the cancelled application stays so, nobody is told',
    change: 'republished',
    world: {
      event: anEvent(CONCERT),
      sessions: [sessionAt(CONCERT.startsAt, 's1', 'cancelled')],
      applications: [anApplication('old', ['s1'], 'cancelled')],
      matches: [
        {
          id: 'old',
          applicationAId: 'old',
          applicationBId: 'old',
          status: 'cancelled',
          cancelReason: 'event_cancelled',
        },
      ],
    },
    after: {
      sessions: [`s1 scheduled ${iso(CONCERT.startsAt)}`],
      applications: ['old cancelled s1'],
      matches: ['old cancelled event_cancelled'],
      inbox: [],
    },
  },
  {
    name: 'another time on the same day: the session moves, the application stays, the applicant is told',
    change: 'rescheduled',
    world: {
      event: anEvent(CONCERT_AT_20),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: [anApplication('waiting', ['s1'], 'paused')],
      matches: [{ id: 'proposed', applicationAId: 'waiting', applicationBId: 'waiting', status: 'proposed' }],
    },
    after: {
      sessions: [`s1 scheduled ${iso(CONCERT_AT_20.startsAt)}`],
      applications: ['waiting paused s1'],
      matches: ['proposed proposed'],
      inbox: [`user event_changed:rescheduled:waiting:${iso(CONCERT.startsAt)}>${iso(CONCERT_AT_20.startsAt)}`],
    },
  },
  {
    name: 'another time, where someone applied for the new time already: the applications wait together',
    change: 'rescheduled',
    world: {
      event: anEvent(CONCERT_AT_20),
      sessions: [sessionAt(CONCERT.startsAt, 's1'), sessionAt(CONCERT_AT_20.startsAt, 's2')],
      applications: [anApplication('early', ['s1']), anApplication('late', ['s2'], 'in_pool', OTHER_ACCOUNT_ID)],
      matches: [],
    },
    after: {
      sessions: [`s1 cancelled ${iso(CONCERT.startsAt)}`, `s2 scheduled ${iso(CONCERT_AT_20.startsAt)}`],
      applications: ['early in_pool s2', 'late in_pool s2'],
      matches: [],
      inbox: [`user event_changed:rescheduled:early:${iso(CONCERT.startsAt)}>${iso(CONCERT_AT_20.startsAt)}`],
    },
  },
  {
    name: 'another day: the session and the application are cancelled, since the applicant picked the day',
    change: 'rescheduled',
    world: {
      event: anEvent({ startsAt: '2026-10-23T19:00:00+03:00', endsAt: '2026-10-23T21:00:00+03:00' }),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: [anApplication('waiting', ['s1'])],
      matches: [{ id: 'proposed', applicationAId: 'waiting', applicationBId: 'waiting', status: 'proposed' }],
    },
    after: {
      sessions: [`s1 cancelled ${iso(CONCERT.startsAt)}`],
      applications: ['waiting cancelled s1'],
      matches: ['proposed cancelled event_cancelled'],
      inbox: [`user event_changed:rescheduled:waiting:${iso(CONCERT.startsAt)}>none`],
    },
  },
  {
    name: 'a run that ends earlier: an application keeps the day that is left and loses the other; one with no day left is cancelled',
    change: 'rescheduled',
    world: {
      event: anEvent({ ...RUN, endsAt: '2026-10-20T21:00:00+03:00' }),
      sessions: [sessionAt(RUN_ON_18, 's18'), sessionAt(RUN_ON_27, 's27')],
      applications: [
        anApplication('both', ['s18', 's27']),
        anApplication('later', ['s27'], 'in_pool', OTHER_ACCOUNT_ID),
      ],
      matches: [],
    },
    after: {
      sessions: [`s18 scheduled ${iso(RUN_ON_18)}`, `s27 cancelled ${iso(RUN_ON_27)}`],
      applications: ['both in_pool s18', 'later cancelled s27'],
      matches: [],
      inbox: [
        `user event_changed:rescheduled:both:${iso(RUN_ON_27)}>none`,
        `other event_changed:rescheduled:later:${iso(RUN_ON_27)}>none`,
      ],
    },
  },
  {
    name: 'a pending proposal of an application left without a day: cancelled, and the partner who keeps a day returns to the pool',
    change: 'rescheduled',
    world: {
      event: anEvent({ ...RUN, endsAt: '2026-10-20T21:00:00+03:00' }),
      sessions: [sessionAt(RUN_ON_18, 's18'), sessionAt(RUN_ON_27, 's27')],
      applications: [
        anApplication('later', ['s27'], 'paired'),
        anApplication('partner', ['s18', 's27'], 'paired', OTHER_ACCOUNT_ID),
      ],
      matches: [{ id: 'proposed', applicationAId: 'later', applicationBId: 'partner', status: 'accepted_b' }],
    },
    after: {
      sessions: [`s18 scheduled ${iso(RUN_ON_18)}`, `s27 cancelled ${iso(RUN_ON_27)}`],
      applications: ['later cancelled s27', 'partner in_pool s18'],
      matches: ['proposed cancelled event_cancelled'],
      inbox: [
        `user event_changed:rescheduled:later:${iso(RUN_ON_27)}>none`,
        `other event_changed:rescheduled:partner:${iso(RUN_ON_27)}>none`,
      ],
    },
  },
  {
    name: 'a day that is gone while the other day is over: the application is cancelled',
    change: 'rescheduled',
    world: {
      event: anEvent({ ...RUN, endsAt: '2026-10-20T21:00:00+03:00' }),
      sessions: [sessionAt(RUN.startsAt, 's14'), sessionAt(RUN_ON_27, 's27')],
      applications: [anApplication('both', ['s14', 's27'])],
      matches: [],
    },
    after: {
      sessions: [`s14 scheduled ${iso(RUN.startsAt)}`, `s27 cancelled ${iso(RUN_ON_27)}`],
      applications: ['both cancelled s14+s27'],
      matches: [],
      inbox: [`user event_changed:rescheduled:both:${iso(RUN_ON_27)}>none`],
    },
  },
  {
    name: "a run whose first day moved forward: the later days' sessions and applications stay, nobody is told",
    change: 'rescheduled',
    world: {
      event: anEvent({ ...RUN, startsAt: '2026-10-15T19:00:00+03:00' }),
      sessions: [sessionAt(RUN.startsAt, 's14'), sessionAt(RUN_ON_18, 's18'), sessionAt(RUN_ON_27, 's27')],
      applications: [anApplication('waiting', ['s18', 's27'])],
      matches: [{ id: 'proposed', applicationAId: 'waiting', applicationBId: 'waiting', status: 'proposed' }],
    },
    after: {
      sessions: [
        `s14 scheduled ${iso(RUN.startsAt)}`,
        `s18 scheduled ${iso(RUN_ON_18)}`,
        `s27 scheduled ${iso(RUN_ON_27)}`,
      ],
      applications: ['waiting in_pool s18+s27'],
      matches: ['proposed proposed'],
      inbox: [],
    },
  },
  {
    name: "an exhibition's passed opening that became its run: nothing changes, nobody is told",
    change: 'rescheduled',
    world: {
      event: anEvent(EXHIBITION_RUN),
      sessions: [sessionAt(OPENING, 'opening'), sessionAt('2026-10-20T12:00:00+03:00', 's20')],
      applications: [anApplication('opening', ['opening']), anApplication('run', ['s20'], 'in_pool', OTHER_ACCOUNT_ID)],
      matches: [],
    },
    after: {
      sessions: [`opening scheduled ${iso(OPENING)}`, `s20 scheduled ${iso('2026-10-20T12:00:00+03:00')}`],
      applications: ['opening in_pool opening', 'run in_pool s20'],
      matches: [],
      inbox: [],
    },
  },
  {
    name: 'an event that no longer exists: nothing changes',
    change: 'cancelled',
    world: {
      event: undefined,
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: [anApplication('waiting', ['s1'])],
      matches: [],
    },
    after: {
      sessions: [`s1 scheduled ${iso(CONCERT.startsAt)}`],
      applications: ['waiting in_pool s1'],
      matches: [],
      inbox: [],
    },
  },
];

describe('EventChangesService.handle', () => {
  for (const { name, change, world: initial, after } of cases) {
    test(`${name}; a second run changes nothing`, async () => {
      const world: World = { inbox: [], ...structuredClone(initial) };
      const { service } = makeService(world);

      await service.handle({ eventId: EVENT_ID, change }, NOW);
      assert.deepEqual(stateOf(world), after);

      await service.handle({ eventId: EVENT_ID, change }, NOW);
      assert.deepEqual(stateOf(world), after);
    });
  }

  test('goes by the event as it is, not by the change the job names', async () => {
    const world: World = { inbox: [], ...structuredClone(cases[0]!.world) };
    const { service } = makeService(world);

    await service.handle({ eventId: EVENT_ID, change: 'rescheduled' }, NOW);

    assert.deepEqual(stateOf(world), cases[0]!.after);
  });

  test('tells the applicant what changed for their application', async () => {
    const world: World = { inbox: [], ...structuredClone(cases[5]!.world) };
    const { service } = makeService(world);

    await service.handle({ eventId: EVENT_ID, change: 'rescheduled' }, NOW);

    assert.deepEqual(
      world.inbox.map(({ accountId, type, payload }) => ({ accountId, type, payload })),
      [
        {
          accountId: ACCOUNT_ID,
          type: 'event_changed',
          payload: {
            eventId: EVENT_ID,
            applicationId: 'both',
            change: 'rescheduled',
            sessions: [{ from: iso(RUN_ON_27), to: null }],
          },
        },
        {
          accountId: OTHER_ACCOUNT_ID,
          type: 'event_changed',
          payload: {
            eventId: EVENT_ID,
            applicationId: 'later',
            change: 'rescheduled',
            sessions: [{ from: iso(RUN_ON_27), to: null }],
          },
        },
      ],
    );
  });

  test('a job after the same change again finds the applicant already told', async () => {
    const world: World = { inbox: [], ...structuredClone(cases[2]!.world) };
    const { service } = makeService(world);
    await service.handle({ eventId: EVENT_ID, change: 'rescheduled' }, NOW);

    // The same move once more, as if the first transaction's sessions had been put back.
    world.sessions[0]!.startsAt = iso(CONCERT.startsAt);
    await service.handle({ eventId: EVENT_ID, change: 'rescheduled' }, NOW);

    assert.equal(world.inbox.length, 1);
  });
});

describe('EventChangesService.onModuleInit', () => {
  useFixedClock();

  test('registers the handler of event.changed, with the default retries', async () => {
    const world: World = { inbox: [], ...structuredClone(cases[0]!.world) };
    const { service, jobs } = makeService(world);

    service.onModuleInit();

    const [name, handler, options] = jobs.register.mock.calls[0]!.arguments;
    assert.equal(name, 'event.changed');
    assert.equal(options, undefined);
    await handler({ id: 'job', name, payload: { eventId: EVENT_ID, change: 'cancelled' } });
    assert.deepEqual(stateOf(world).applications, cases[0]!.after.applications);
  });
});
