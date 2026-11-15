// Written with the help of Claude
// What a changed event does to its sessions (matching.md, rule 10): the check a producer makes before it enqueues
// event.changed, and the reconciliation the consumer asks the catalog for.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { EventSessionsRepository } from '../../dist/core/catalog/repositories/event-sessions.repository.js';
import type { EventsRepository } from '../../dist/core/catalog/repositories/events.repository.js';
import { EventSessionsService } from '../../dist/core/catalog/services/event-sessions.service.js';
import { sessionScheduleChanged } from '../../dist/core/catalog/services/session-start.js';
import type { Event } from '../../dist/core/catalog/types/event.js';
import type { EventSessionRecord, SessionStatus } from '../../dist/core/catalog/types/event-session.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import { anEvent, EVENT_ID } from './fixtures/catalog.ts';
import { NOW } from './fixtures/clock.ts';

type Times = Pick<Event, 'startsAt' | 'endsAt'>;

const TX = {} as Transaction;

/** NOW is 12:00 in Kyiv on 15 October. A concert a week later. */
const CONCERT: Times = { startsAt: '2026-10-22T19:00:00+03:00', endsAt: '2026-10-22T21:00:00+03:00' };
/** A show at 19:00 every day from 14 to 30 October; Kyiv is on +02:00 from the 25th. */
const RUN: Times = { startsAt: '2026-10-14T19:00:00+03:00', endsAt: '2026-10-30T21:00:00+02:00' };
/** An exhibition's opening, yesterday. */
const OPENING: Times = { startsAt: '2026-10-14T17:00:00+03:00', endsAt: '2026-10-14T19:00:00+03:00' };
/** The same exhibition as its run, from today at the default 12:00, which has just started. */
const EXHIBITION_RUN: Times = { startsAt: '2026-10-15T12:00:00+03:00', endsAt: '2026-11-10T23:59:59+02:00' };

describe('sessionScheduleChanged', () => {
  const cases: { name: string; previous: Times; next: Times; changed: boolean }[] = [
    { name: 'the same times', previous: CONCERT, next: CONCERT, changed: false },
    {
      name: 'another time on the same day',
      previous: CONCERT,
      next: { startsAt: '2026-10-22T20:00:00+03:00', endsAt: '2026-10-22T22:00:00+03:00' },
      changed: true,
    },
    {
      name: 'another day',
      previous: CONCERT,
      next: { startsAt: '2026-10-23T19:00:00+03:00', endsAt: '2026-10-23T21:00:00+03:00' },
      changed: true,
    },
    {
      name: 'only a later end of a single-day event',
      previous: CONCERT,
      next: { ...CONCERT, endsAt: '2026-10-22T21:30:00+03:00' },
      changed: false,
    },
    {
      name: "a run's first day moving forward to today",
      previous: RUN,
      next: { ...RUN, startsAt: '2026-10-15T19:00:00+03:00' },
      changed: false,
    },
    {
      name: 'a run that ends earlier',
      previous: RUN,
      next: { ...RUN, endsAt: '2026-10-20T21:00:00+03:00' },
      changed: true,
    },
    {
      name: 'a run that ends later',
      previous: RUN,
      next: { ...RUN, endsAt: '2026-11-05T21:00:00+02:00' },
      changed: false,
    },
    {
      name: 'a run at another time of day',
      previous: RUN,
      next: { ...RUN, startsAt: '2026-10-15T18:00:00+03:00' },
      changed: true,
    },
    {
      name: "an exhibition's passed opening becoming its run",
      previous: OPENING,
      next: EXHIBITION_RUN,
      changed: false,
    },
    {
      name: "an exhibition run's first day moving forward",
      previous: { ...EXHIBITION_RUN, startsAt: '2026-10-14T12:00:00+03:00' },
      next: EXHIBITION_RUN,
      changed: false,
    },
    {
      name: 'an event that is over',
      previous: OPENING,
      next: { startsAt: '2026-10-14T18:00:00+03:00', endsAt: '2026-10-14T19:00:00+03:00' },
      changed: false,
    },
  ];
  for (const { name, previous, next, changed } of cases) {
    test(`${name}: ${changed ? 'changed' : 'not changed'}`, () => {
      assert.equal(sessionScheduleChanged(previous, next, NOW), changed);
    });
  }
});

interface StoredSession {
  id: string;
  startsAt: string;
  status: SessionStatus;
}

function at(kyivTime: string, id: string, status: SessionStatus = 'scheduled'): StoredSession {
  return { id, startsAt: new Date(kyivTime).toISOString(), status };
}

/** The service over sessions kept in memory, so a second call sees what the first one did. */
function makeService(event: Event | undefined, sessions: StoredSession[]) {
  const records = (): EventSessionRecord[] =>
    sessions
      .map((session) => ({ ...session, eventId: EVENT_ID, event: event ?? CONCERT }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const eventSessionsRepository: Pick<EventSessionsRepository, 'findByEvent' | 'setStatus' | 'move'> = {
    findByEvent: () => Promise.resolve(records()),
    setStatus: (ids, status) => {
      for (const session of sessions.filter(({ id }) => ids.includes(id))) {
        session.status = status;
      }
      return Promise.resolve();
    },
    move: (id, startsAt) => {
      const taken = sessions.some((session) => session.startsAt === startsAt.toISOString());
      assert.equal(taken, false, 'the event has a session at the new start already');
      sessions.find((session) => session.id === id)!.startsAt = startsAt.toISOString();
      return Promise.resolve();
    },
  };
  const eventsRepository: Pick<EventsRepository, 'findById'> = { findById: () => Promise.resolve(event) };
  return new EventSessionsService(
    eventsRepository as EventsRepository,
    eventSessionsRepository as EventSessionsRepository,
  );
}

describe('EventSessionsService.reconcile', () => {
  const iso = (kyivTime: string) => new Date(kyivTime).toISOString();
  const cases: {
    name: string;
    event: Event | undefined;
    sessions: StoredSession[];
    cancelled?: string[];
    moved?: { sessionId: string; to: string; intoSessionId?: string }[];
    reopened?: string[];
    /** The sessions afterwards, as "id status start". */
    after: string[];
  }[] = [
    {
      name: 'an event that does not exist changes nothing',
      event: undefined,
      sessions: [at(CONCERT.startsAt, 's1')],
      after: [`s1 scheduled ${iso(CONCERT.startsAt)}`],
    },
    {
      name: 'an unchanged published event keeps its session',
      event: anEvent(CONCERT),
      sessions: [at(CONCERT.startsAt, 's1')],
      after: [`s1 scheduled ${iso(CONCERT.startsAt)}`],
    },
    {
      name: 'a cancelled event has its coming sessions cancelled, and its past one left',
      event: anEvent({ ...RUN, status: 'cancelled' }),
      sessions: [
        at('2026-10-14T19:00:00+03:00', 'past'),
        at('2026-10-16T19:00:00+03:00', 's1'),
        at('2026-10-27T19:00:00+02:00', 's2'),
      ],
      cancelled: ['s1', 's2'],
      after: [
        `past scheduled ${iso('2026-10-14T19:00:00+03:00')}`,
        `s1 cancelled ${iso('2026-10-16T19:00:00+03:00')}`,
        `s2 cancelled ${iso('2026-10-27T19:00:00+02:00')}`,
      ],
    },
    {
      name: 'another time on the same day moves the session',
      event: anEvent({ startsAt: '2026-10-22T20:00:00+03:00', endsAt: '2026-10-22T22:00:00+03:00' }),
      sessions: [at(CONCERT.startsAt, 's1')],
      moved: [{ sessionId: 's1', to: iso('2026-10-22T20:00:00+03:00') }],
      after: [`s1 scheduled ${iso('2026-10-22T20:00:00+03:00')}`],
    },
    {
      name: 'a session that exists at the new time takes the place of the moved one',
      event: anEvent({ startsAt: '2026-10-22T20:00:00+03:00', endsAt: '2026-10-22T22:00:00+03:00' }),
      sessions: [at(CONCERT.startsAt, 's1'), at('2026-10-22T20:00:00+03:00', 's2')],
      moved: [{ sessionId: 's1', to: iso('2026-10-22T20:00:00+03:00'), intoSessionId: 's2' }],
      after: [`s1 cancelled ${iso(CONCERT.startsAt)}`, `s2 scheduled ${iso('2026-10-22T20:00:00+03:00')}`],
    },
    {
      name: 'an event moved to another day has its session cancelled',
      event: anEvent({ startsAt: '2026-10-23T19:00:00+03:00', endsAt: '2026-10-23T21:00:00+03:00' }),
      sessions: [at(CONCERT.startsAt, 's1')],
      cancelled: ['s1'],
      after: [`s1 cancelled ${iso(CONCERT.startsAt)}`],
    },
    {
      name: 'a run that ends earlier keeps the days it still has and cancels the others',
      event: anEvent({ ...RUN, endsAt: '2026-10-20T21:00:00+03:00' }),
      sessions: [at('2026-10-18T19:00:00+03:00', 's1'), at('2026-10-27T19:00:00+02:00', 's2')],
      cancelled: ['s2'],
      after: [`s1 scheduled ${iso('2026-10-18T19:00:00+03:00')}`, `s2 cancelled ${iso('2026-10-27T19:00:00+02:00')}`],
    },
    {
      name: "a run whose first day moved forward keeps its later days' sessions",
      event: anEvent({ ...RUN, startsAt: '2026-10-15T19:00:00+03:00' }),
      sessions: [
        at('2026-10-14T19:00:00+03:00', 'past'),
        at('2026-10-15T19:00:00+03:00', 's1'),
        at('2026-10-27T19:00:00+02:00', 's2'),
      ],
      after: [
        `past scheduled ${iso('2026-10-14T19:00:00+03:00')}`,
        `s1 scheduled ${iso('2026-10-15T19:00:00+03:00')}`,
        `s2 scheduled ${iso('2026-10-27T19:00:00+02:00')}`,
      ],
    },
    {
      name: "an exhibition that became its run keeps the opening's past session and the run's days",
      event: anEvent(EXHIBITION_RUN),
      sessions: [at(OPENING.startsAt, 'opening'), at('2026-10-20T12:00:00+03:00', 's1')],
      after: [`opening scheduled ${iso(OPENING.startsAt)}`, `s1 scheduled ${iso('2026-10-20T12:00:00+03:00')}`],
    },
    {
      name: 'an event published again has the cancelled sessions it still has scheduled again',
      event: anEvent(RUN),
      sessions: [
        at('2026-10-14T19:00:00+03:00', 'past', 'cancelled'),
        at('2026-10-16T19:00:00+03:00', 's1', 'cancelled'),
        at('2026-10-17T18:00:00+03:00', 'other', 'cancelled'),
      ],
      reopened: ['s1'],
      after: [
        `past cancelled ${iso('2026-10-14T19:00:00+03:00')}`,
        `s1 scheduled ${iso('2026-10-16T19:00:00+03:00')}`,
        `other cancelled ${iso('2026-10-17T18:00:00+03:00')}`,
      ],
    },
  ];
  for (const { name, event, sessions, cancelled = [], moved = [], reopened = [], after } of cases) {
    test(`${name}; a second call changes nothing`, async () => {
      const stored = sessions.map((session) => ({ ...session }));
      const service = makeService(event, stored);

      const changes = await service.reconcile(EVENT_ID, TX, NOW);

      assert.equal(changes.eventStatus, event?.status);
      assert.deepEqual(
        changes.cancelled.map(({ sessionId }) => sessionId),
        cancelled,
      );
      assert.deepEqual(
        changes.moved.map(({ from: _from, ...move }) => move),
        moved,
      );
      assert.deepEqual(changes.reopened, reopened);
      const state = () => stored.map(({ id, status, startsAt }) => `${id} ${status} ${startsAt}`);
      assert.deepEqual(state(), after);

      const again = await service.reconcile(EVENT_ID, TX, NOW);

      assert.deepEqual(
        { ...again, eventStatus: undefined },
        { eventStatus: undefined, cancelled: [], moved: [], reopened: [] },
      );
      assert.deepEqual(state(), after);
    });
  }
});
