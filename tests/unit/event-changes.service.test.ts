// Written with the help of Claude
// The consumer of event.changed (matching.md, rule 10), over an event, its sessions, applications, proposals and the
// inbox kept in memory, so that running a job twice shows whether the second run changes anything.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, mock, test } from 'node:test';
import type { Event } from '../../dist/core/catalog/types/event.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { JobQueue } from '../../dist/core/jobs/adapters/job-queue.js';
import type { ApplicationsRepository } from '../../dist/core/matching/repositories/applications.repository.js';
import type { MatchesRepository } from '../../dist/core/matching/repositories/matches.repository.js';
import { EventChangesService } from '../../dist/core/matching/services/event-changes.service.js';
import type { MatchingService } from '../../dist/core/matching/services/matching.service.js';
import type { Application, ApplicationStatus } from '../../dist/core/matching/types/application.js';
import type { MatchRecord, MatchStatus } from '../../dist/core/matching/types/match.js';
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
  /** The sessions whose rounds were planned, once per created session. */
  roundsPlanned: string[];
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
  const matchesRepository: Pick<
    MatchesRepository,
    'lockEvent' | 'cancelPending' | 'findByApplication' | 'cancelAndReturnBoth' | 'cancelMutual'
  > = {
    lockEvent: (eventId, tx) => {
      inTransaction(tx);
      assert.equal(eventId, EVENT_ID);
      world.locked = true;
      return Promise.resolve();
    },
    findByApplication: (applicationId, statuses, tx) => {
      inTransaction(tx);
      const match = world.matches.find(
        ({ applicationAId, applicationBId, status }) =>
          statuses.includes(status as MatchStatus) && [applicationAId, applicationBId].includes(applicationId),
      );
      const application = (id: string) => structuredClone(world.applications.find((stored) => stored.id === id)!);
      return Promise.resolve(
        match &&
          ({
            ...match,
            applicationA: application(match.applicationAId),
            applicationB: application(match.applicationBId),
          } as unknown as MatchRecord),
      );
    },
    cancelAndReturnBoth: (match, reason, tx) => {
      inTransaction(tx);
      const stored = world.matches.find(({ id }) => id === match.id)!;
      assert.ok(PENDING.includes(stored.status), 'only a pending proposal is cancelled');
      Object.assign(stored, { status: 'cancelled', cancelReason: reason });
      for (const application of world.applications) {
        if ([match.applicationAId, match.applicationBId].includes(application.id) && application.status === 'paired') {
          application.status = 'in_pool';
        }
      }
      return Promise.resolve();
    },
    cancelMutual: (matches, reason, tx) => {
      inTransaction(tx);
      assert.ok(world.locked, 'matches change only under the event lock');
      for (const match of matches) {
        const stored = world.matches.find(({ id }) => id === match.id)!;
        if (stored.status === 'mutual') {
          Object.assign(stored, { status: 'cancelled', cancelReason: reason });
        }
        for (const application of world.applications) {
          if (
            [match.applicationAId, match.applicationBId].includes(application.id) &&
            application.status === 'paired'
          ) {
            application.status = 'in_pool';
          }
        }
      }
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
    notify: (accountId, type, payload, dedupeKey, tx) => {
      inTransaction(tx);
      if (world.inbox.some((told) => told.dedupeKey === dedupeKey)) {
        return Promise.resolve(undefined);
      }
      world.inbox.push({ accountId, type, payload, dedupeKey });
      return Promise.resolve({
        id: randomUUID(),
        accountId,
        type,
        payload,
        pushStatus: 'pending',
        readAt: null,
        createdAt: new Date().toISOString(),
      });
    },
  };
  const matchingService = {
    scheduleRounds: mock.fn<MatchingService['scheduleRounds']>((sessions, tx) => {
      inTransaction(tx);
      world.roundsPlanned.push(...sessions.filter(({ created }) => created).map(({ id }) => id));
      return Promise.resolve();
    }),
  };
  const transactions: TransactionRunner = { run: (work) => work(TX) };
  const jobs = { register: mock.fn<JobQueue['register']>() };
  const service = new EventChangesService(
    jobs as unknown as JobQueue,
    transactions,
    sessionsServiceOver(world),
    applicationsRepository as ApplicationsRepository,
    matchesRepository as MatchesRepository,
    matchingService as unknown as MatchingService,
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
/** The run cut short to end on 20 October: its session on the 18th stays, the one on the 27th is gone. */
const RUN_ENDING_ON_20 = { ...RUN, endsAt: '2026-10-20T21:00:00+03:00' };
const RUN_SESSIONS = () => [sessionAt(RUN_ON_18, 's18'), sessionAt(RUN_ON_27, 's27')];
const RUN_SESSIONS_AFTER_ENDING_ON_20 = [`s18 scheduled ${iso(RUN_ON_18)}`, `s27 cancelled ${iso(RUN_ON_27)}`];
const CONCERT_SESSIONS_AFTER_MOVING_TO_20 = [
  `s1 cancelled ${iso(CONCERT.startsAt)}`,
  `new1 scheduled ${iso(CONCERT_AT_20.startsAt)}`,
];
const CONCERT_MOVED_TO_20 = `${iso(CONCERT.startsAt)}>${iso(CONCERT_AT_20.startsAt)}`;
const RUN_ON_27_GONE = `${iso(RUN_ON_27)}>none`;

/** Application `a` of the user and `b` of the other user, both with `status`. */
function aPair(daysOfA: string[], daysOfB: string[], status: ApplicationStatus = 'paired') {
  return [anApplication('a', daysOfA, status), anApplication('b', daysOfB, status, OTHER_ACCOUNT_ID)];
}

/** A match between `a` and `b` of `aPair`. */
function aMatchOfPair(id: string, status: string, cancelReason?: string): StoredMatch {
  return {
    id,
    applicationAId: 'a',
    applicationBId: 'b',
    status,
    ...(cancelReason === undefined ? {} : { cancelReason }),
  };
}

/** The inbox once both of `aPair` were told: `change` is `cancelled`, or `rescheduled` with its days. */
function bothTold(change: 'cancelled' | 'rescheduled', days?: string): string[] {
  const key = (applicationId: string) => `event_changed:${change}:${applicationId}${days ? `:${days}` : ''}`;
  return [`user ${key('a')}`, `other ${key('b')}`];
}

interface Case {
  name: string;
  change: 'cancelled' | 'republished' | 'rescheduled';
  world: Omit<World, 'inbox' | 'roundsPlanned'>;
  /** The sessions whose rounds the change planned. */
  rounds?: string[];
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
        'mutual cancelled event_cancelled',
        'declined declined',
      ],
      inbox: ['user event_changed:cancelled:waiting', 'other event_changed:cancelled:paired'],
    },
  },
  {
    name: 'a mutual match on a cancelled event: cancelled for the event, and both are told',
    change: 'cancelled',
    world: {
      event: anEvent({ ...CONCERT, status: 'cancelled' }),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: aPair(['s1'], ['s1']),
      matches: [aMatchOfPair('mutual', 'mutual')],
    },
    after: {
      sessions: [`s1 cancelled ${iso(CONCERT.startsAt)}`],
      applications: ['a cancelled s1', 'b cancelled s1'],
      matches: ['mutual cancelled event_cancelled'],
      inbox: bothTold('cancelled'),
    },
  },
  {
    name: 'a mutual match whose shared day moved to another time: kept on the new session, and both are told',
    change: 'rescheduled',
    world: {
      event: anEvent(CONCERT_AT_20),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: aPair(['s1'], ['s1']),
      matches: [aMatchOfPair('mutual', 'mutual')],
    },
    rounds: ['new1'],
    after: {
      sessions: CONCERT_SESSIONS_AFTER_MOVING_TO_20,
      applications: ['a paired new1', 'b paired new1'],
      matches: ['mutual mutual'],
      inbox: bothTold('rescheduled', CONCERT_MOVED_TO_20),
    },
  },
  {
    name: 'a mutual match whose only shared day is cancelled: cancelled, and the side that keeps a day returns to the pool',
    change: 'rescheduled',
    world: {
      event: anEvent(RUN_ENDING_ON_20),
      sessions: RUN_SESSIONS(),
      applications: aPair(['s27'], ['s18', 's27']),
      matches: [aMatchOfPair('mutual', 'mutual')],
    },
    after: {
      sessions: RUN_SESSIONS_AFTER_ENDING_ON_20,
      applications: ['a cancelled s27', 'b in_pool s18'],
      matches: ['mutual cancelled event_cancelled'],
      inbox: bothTold('rescheduled', RUN_ON_27_GONE),
    },
  },
  {
    name: 'a mutual match that keeps a shared day ahead: kept, though another shared day is cancelled',
    change: 'rescheduled',
    world: {
      event: anEvent(RUN_ENDING_ON_20),
      sessions: RUN_SESSIONS(),
      applications: aPair(['s18', 's27'], ['s18', 's27']),
      matches: [aMatchOfPair('mutual', 'mutual')],
    },
    after: {
      sessions: RUN_SESSIONS_AFTER_ENDING_ON_20,
      applications: ['a paired s18', 'b paired s18'],
      matches: ['mutual mutual'],
      inbox: bothTold('rescheduled', RUN_ON_27_GONE),
    },
  },
  {
    name: 'a mutual match whose shared day is over: left as it is, though a later day of one side is cancelled',
    change: 'rescheduled',
    world: {
      event: anEvent(RUN_ENDING_ON_20),
      sessions: [sessionAt(RUN.startsAt, 's14'), sessionAt(RUN_ON_27, 's27')],
      applications: aPair(['s14', 's27'], ['s14']),
      matches: [aMatchOfPair('mutual', 'mutual')],
    },
    after: {
      sessions: [`s14 scheduled ${iso(RUN.startsAt)}`, `s27 cancelled ${iso(RUN_ON_27)}`],
      applications: ['a cancelled s14+s27', 'b paired s14'],
      matches: ['mutual mutual'],
      inbox: [`user event_changed:rescheduled:a:${RUN_ON_27_GONE}`],
    },
  },
  {
    name: 'an event published again after a mutual match was cancelled: the match stays cancelled, nobody is told',
    change: 'republished',
    world: {
      event: anEvent(CONCERT),
      sessions: [sessionAt(CONCERT.startsAt, 's1', 'cancelled')],
      applications: aPair(['s1'], ['s1'], 'cancelled'),
      matches: [aMatchOfPair('mutual', 'cancelled', 'event_cancelled')],
    },
    after: {
      sessions: [`s1 scheduled ${iso(CONCERT.startsAt)}`],
      applications: ['a cancelled s1', 'b cancelled s1'],
      matches: ['mutual cancelled event_cancelled'],
      inbox: [],
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
    name: 'another time on the same day: the applications go to a new session with its own rounds, and each is told',
    change: 'rescheduled',
    world: {
      event: anEvent(CONCERT_AT_20),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: [anApplication('waiting', ['s1'], 'paused')],
      matches: [],
    },
    rounds: ['new1'],
    after: {
      sessions: CONCERT_SESSIONS_AFTER_MOVING_TO_20,
      applications: ['waiting paused new1'],
      matches: [],
      inbox: [`user event_changed:rescheduled:waiting:${CONCERT_MOVED_TO_20}`],
    },
  },
  {
    name: 'a pending proposal on a shared day that moved: cancelled for the change, and both return to the pool',
    change: 'rescheduled',
    world: {
      event: anEvent(CONCERT_AT_20),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: aPair(['s1'], ['s1']),
      matches: [aMatchOfPair('proposed', 'accepted_a')],
    },
    rounds: ['new1'],
    after: {
      sessions: CONCERT_SESSIONS_AFTER_MOVING_TO_20,
      applications: ['a in_pool new1', 'b in_pool new1'],
      matches: ['proposed cancelled event_changed'],
      inbox: bothTold('rescheduled', CONCERT_MOVED_TO_20),
    },
  },
  {
    name: 'a pending proposal whose shared day stays: kept, though another day of one side moved',
    change: 'rescheduled',
    world: {
      event: anEvent({ ...RUN, startsAt: '2026-10-14T20:00:00+03:00' }),
      sessions: [sessionAt(RUN.startsAt, 'past'), sessionAt(RUN_ON_18, 's18')],
      applications: aPair(['past'], ['past', 's18']),
      matches: [aMatchOfPair('proposed', 'proposed')],
    },
    rounds: ['new1'],
    after: {
      sessions: [
        `past scheduled ${iso(RUN.startsAt)}`,
        `s18 cancelled ${iso(RUN_ON_18)}`,
        `new1 scheduled ${iso('2026-10-18T20:00:00+03:00')}`,
      ],
      applications: ['a paired past', 'b paired past+new1'],
      matches: ['proposed proposed'],
      inbox: [`other event_changed:rescheduled:b:${iso(RUN_ON_18)}>${iso('2026-10-18T20:00:00+03:00')}`],
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
      event: anEvent(RUN_ENDING_ON_20),
      sessions: RUN_SESSIONS(),
      applications: [
        anApplication('both', ['s18', 's27']),
        anApplication('later', ['s27'], 'in_pool', OTHER_ACCOUNT_ID),
      ],
      matches: [],
    },
    after: {
      sessions: RUN_SESSIONS_AFTER_ENDING_ON_20,
      applications: ['both in_pool s18', 'later cancelled s27'],
      matches: [],
      inbox: [
        `user event_changed:rescheduled:both:${RUN_ON_27_GONE}`,
        `other event_changed:rescheduled:later:${RUN_ON_27_GONE}`,
      ],
    },
  },
  {
    name: 'a pending proposal of an application left without a day: cancelled, and the partner who keeps a day returns to the pool',
    change: 'rescheduled',
    world: {
      event: anEvent(RUN_ENDING_ON_20),
      sessions: RUN_SESSIONS(),
      applications: [
        anApplication('later', ['s27'], 'paired'),
        anApplication('partner', ['s18', 's27'], 'paired', OTHER_ACCOUNT_ID),
      ],
      matches: [{ id: 'proposed', applicationAId: 'later', applicationBId: 'partner', status: 'accepted_b' }],
    },
    after: {
      sessions: RUN_SESSIONS_AFTER_ENDING_ON_20,
      applications: ['later cancelled s27', 'partner in_pool s18'],
      matches: ['proposed cancelled event_cancelled'],
      inbox: [
        `user event_changed:rescheduled:later:${RUN_ON_27_GONE}`,
        `other event_changed:rescheduled:partner:${RUN_ON_27_GONE}`,
      ],
    },
  },
  {
    name: 'a day that is gone while the other day is over: the application is cancelled',
    change: 'rescheduled',
    world: {
      event: anEvent(RUN_ENDING_ON_20),
      sessions: [sessionAt(RUN.startsAt, 's14'), sessionAt(RUN_ON_27, 's27')],
      applications: [anApplication('both', ['s14', 's27'])],
      matches: [],
    },
    after: {
      sessions: [`s14 scheduled ${iso(RUN.startsAt)}`, `s27 cancelled ${iso(RUN_ON_27)}`],
      applications: ['both cancelled s14+s27'],
      matches: [],
      inbox: [`user event_changed:rescheduled:both:${RUN_ON_27_GONE}`],
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

/** The case whose name starts with `start`. */
function caseNamed(start: string): Case {
  return cases.find(({ name }) => name.startsWith(start))!;
}

describe('EventChangesService.handle', () => {
  for (const { name, change, world: initial, rounds = [], after } of cases) {
    test(`${name}; a second run changes nothing`, async () => {
      const world: World = { inbox: [], roundsPlanned: [], ...structuredClone(initial) };
      const { service } = makeService(world);

      await service.handle({ eventId: EVENT_ID, change }, NOW);
      assert.deepEqual(stateOf(world), after);
      assert.deepEqual(world.roundsPlanned, rounds);

      await service.handle({ eventId: EVENT_ID, change }, NOW);
      assert.deepEqual(stateOf(world), after);
      assert.deepEqual(world.roundsPlanned, rounds, 'a second run plans no rounds');
    });
  }

  test('goes by the event as it is, not by the change the job names', async () => {
    const world: World = { inbox: [], roundsPlanned: [], ...structuredClone(cases[0]!.world) };
    const { service } = makeService(world);

    await service.handle({ eventId: EVENT_ID, change: 'rescheduled' }, NOW);

    assert.deepEqual(stateOf(world), cases[0]!.after);
  });

  test('tells the applicant what changed for their application', async () => {
    const world: World = {
      inbox: [],
      roundsPlanned: [],
      ...structuredClone(caseNamed('a run that ends earlier').world),
    };
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

  test('tells both sides of a mutual match whether the match stands', async () => {
    for (const [start, cancelled] of [
      ['a mutual match on a cancelled event', true],
      ['a mutual match whose shared day moved', false],
    ] as const) {
      const world: World = { inbox: [], roundsPlanned: [], ...structuredClone(caseNamed(start).world) };
      const { service } = makeService(world);

      await service.handle({ eventId: EVENT_ID, change: 'cancelled' }, NOW);

      assert.deepEqual(
        world.inbox.map(({ accountId, payload }) => [accountId, payload.applicationId, payload.match]),
        [
          [ACCOUNT_ID, 'a', { id: 'mutual', cancelled }],
          [OTHER_ACCOUNT_ID, 'b', { id: 'mutual', cancelled }],
        ],
        start,
      );
    }
  });

  test('moved to another time and back: the first session is scheduled again with its rounds, none planned twice', async () => {
    const world: World = {
      inbox: [],
      roundsPlanned: [],
      event: anEvent(CONCERT_AT_20),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      applications: [anApplication('waiting', ['s1'])],
      matches: [],
    };
    const { service } = makeService(world);
    await service.handle({ eventId: EVENT_ID, change: 'rescheduled' }, NOW);

    world.event = anEvent(CONCERT);
    await service.handle({ eventId: EVENT_ID, change: 'rescheduled' }, NOW);

    assert.deepEqual(stateOf(world).sessions, [
      `s1 scheduled ${iso(CONCERT.startsAt)}`,
      `new1 cancelled ${iso(CONCERT_AT_20.startsAt)}`,
    ]);
    assert.deepEqual(stateOf(world).applications, ['waiting in_pool s1']);
    assert.deepEqual(world.roundsPlanned, ['new1'], "s1's round jobs are still queued, so none are planned for it");
    assert.equal(world.inbox.length, 2);
  });
});

describe('EventChangesService.onModuleInit', () => {
  useFixedClock();

  test('registers the handler of event.changed, with the default retries', async () => {
    const world: World = { inbox: [], roundsPlanned: [], ...structuredClone(cases[0]!.world) };
    const { service, jobs } = makeService(world);

    service.onModuleInit();

    const [name, handler, options] = jobs.register.mock.calls[0]!.arguments;
    assert.equal(name, 'event.changed');
    assert.equal(options, undefined);
    await handler({ id: 'job', name, payload: { eventId: EVENT_ID, change: 'cancelled' } });
    assert.deepEqual(stateOf(world).applications, cases[0]!.after.applications);
  });
});
