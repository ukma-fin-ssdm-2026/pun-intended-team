// Written with the help of Claude
// What a changed event does to its sessions (matching.md, rule 10): the check a producer makes before it enqueues
// event.changed, and the reconciliation the consumer asks the catalog for.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sessionScheduleChanged } from '../../dist/core/catalog/services/session-start.js';
import type { Event } from '../../dist/core/catalog/types/event.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import { anEvent, EVENT_ID } from './fixtures/catalog.ts';
import { NOW } from './fixtures/clock.ts';
import { sessionAt, sessionStates, sessionsServiceOver, type StoredSession } from './fixtures/event-sessions.ts';

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
/** A museum day today, 10:00 to 18:00: it started two hours ago, and takes applications until its cutoff at 16:00. */
const MUSEUM_DAY: Times = { startsAt: '2026-10-15T10:00:00+03:00', endsAt: '2026-10-15T18:00:00+03:00' };
/** The museum day changed at 12:00 to 12:30–14:00: under these times the 10:00 session's cutoff has just passed. */
const MUSEUM_DAY_SHORTENED: Times = { startsAt: '2026-10-15T12:30:00+03:00', endsAt: '2026-10-15T14:00:00+03:00' };

describe('sessionScheduleChanged', () => {
  const cases: { name: string; previous: Times; next: Times; changed: boolean }[] = [
    { name: 'the same times', previous: CONCERT, next: CONCERT, changed: false },
    {
      name: 'a museum day that started, moved to a time still ahead',
      previous: MUSEUM_DAY,
      next: MUSEUM_DAY_SHORTENED,
      changed: true,
    },
    {
      name: 'a museum day that started, moved to a time that is over too: matching would change nothing',
      previous: MUSEUM_DAY,
      next: { startsAt: '2026-10-15T09:00:00+03:00', endsAt: '2026-10-15T11:00:00+03:00' },
      changed: false,
    },
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

describe('EventSessionsService.reconcile', () => {
  const iso = (kyivTime: string) => new Date(kyivTime).toISOString();
  const cases: {
    name: string;
    event: Event | undefined;
    sessions: StoredSession[];
    cancelled?: string[];
    moved?: { sessionId: string; to: string; intoSessionId: string }[];
    /** The sessions moved to, "id" or "id created". */
    movedTo?: string[];
    reopened?: string[];
    /** The sessions afterwards, as "id status start". */
    after: string[];
  }[] = [
    {
      name: 'an event that does not exist changes nothing',
      event: undefined,
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      after: [`s1 scheduled ${iso(CONCERT.startsAt)}`],
    },
    {
      name: 'an unchanged published event keeps its session',
      event: anEvent(CONCERT),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      after: [`s1 scheduled ${iso(CONCERT.startsAt)}`],
    },
    {
      name: 'a cancelled event has its coming sessions cancelled, and its past one left',
      event: anEvent({ ...RUN, status: 'cancelled' }),
      sessions: [
        sessionAt('2026-10-14T19:00:00+03:00', 'past'),
        sessionAt('2026-10-16T19:00:00+03:00', 's1'),
        sessionAt('2026-10-27T19:00:00+02:00', 's2'),
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
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      moved: [{ sessionId: 's1', to: iso('2026-10-22T20:00:00+03:00'), intoSessionId: 'new1' }],
      movedTo: ['new1 created'],
      after: [`s1 cancelled ${iso(CONCERT.startsAt)}`, `new1 scheduled ${iso('2026-10-22T20:00:00+03:00')}`],
    },
    {
      name: 'a museum day that started and now starts later today moves the session, though its old cutoff passed',
      event: anEvent(MUSEUM_DAY_SHORTENED),
      sessions: [sessionAt(MUSEUM_DAY.startsAt, 's1')],
      moved: [{ sessionId: 's1', to: iso(MUSEUM_DAY_SHORTENED.startsAt), intoSessionId: 'new1' }],
      movedTo: ['new1 created'],
      after: [`s1 cancelled ${iso(MUSEUM_DAY.startsAt)}`, `new1 scheduled ${iso(MUSEUM_DAY_SHORTENED.startsAt)}`],
    },
    {
      name: 'a session that exists at the new time takes the place of the moved one',
      event: anEvent({ startsAt: '2026-10-22T20:00:00+03:00', endsAt: '2026-10-22T22:00:00+03:00' }),
      sessions: [sessionAt(CONCERT.startsAt, 's1'), sessionAt('2026-10-22T20:00:00+03:00', 's2')],
      moved: [{ sessionId: 's1', to: iso('2026-10-22T20:00:00+03:00'), intoSessionId: 's2' }],
      movedTo: ['s2'],
      after: [`s1 cancelled ${iso(CONCERT.startsAt)}`, `s2 scheduled ${iso('2026-10-22T20:00:00+03:00')}`],
    },
    {
      name: 'moved back to its first time: the cancelled session there is scheduled again, not created',
      event: anEvent(CONCERT),
      sessions: [sessionAt(CONCERT.startsAt, 's1', 'cancelled'), sessionAt('2026-10-22T20:00:00+03:00', 'new1')],
      moved: [{ sessionId: 'new1', to: iso(CONCERT.startsAt), intoSessionId: 's1' }],
      reopened: ['s1'],
      movedTo: ['s1'],
      after: [`s1 scheduled ${iso(CONCERT.startsAt)}`, `new1 cancelled ${iso('2026-10-22T20:00:00+03:00')}`],
    },
    {
      name: 'an event moved to another day has its session cancelled',
      event: anEvent({ startsAt: '2026-10-23T19:00:00+03:00', endsAt: '2026-10-23T21:00:00+03:00' }),
      sessions: [sessionAt(CONCERT.startsAt, 's1')],
      cancelled: ['s1'],
      after: [`s1 cancelled ${iso(CONCERT.startsAt)}`],
    },
    {
      name: 'a run that ends earlier keeps the days it still has and cancels the others',
      event: anEvent({ ...RUN, endsAt: '2026-10-20T21:00:00+03:00' }),
      sessions: [sessionAt('2026-10-18T19:00:00+03:00', 's1'), sessionAt('2026-10-27T19:00:00+02:00', 's2')],
      cancelled: ['s2'],
      after: [`s1 scheduled ${iso('2026-10-18T19:00:00+03:00')}`, `s2 cancelled ${iso('2026-10-27T19:00:00+02:00')}`],
    },
    {
      name: "a run whose first day moved forward keeps its later days' sessions",
      event: anEvent({ ...RUN, startsAt: '2026-10-15T19:00:00+03:00' }),
      sessions: [
        sessionAt('2026-10-14T19:00:00+03:00', 'past'),
        sessionAt('2026-10-15T19:00:00+03:00', 's1'),
        sessionAt('2026-10-27T19:00:00+02:00', 's2'),
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
      sessions: [sessionAt(OPENING.startsAt, 'opening'), sessionAt('2026-10-20T12:00:00+03:00', 's1')],
      after: [`opening scheduled ${iso(OPENING.startsAt)}`, `s1 scheduled ${iso('2026-10-20T12:00:00+03:00')}`],
    },
    {
      name: 'an event published again has the cancelled sessions it still has scheduled again',
      event: anEvent(RUN),
      sessions: [
        sessionAt('2026-10-14T19:00:00+03:00', 'past', 'cancelled'),
        sessionAt('2026-10-16T19:00:00+03:00', 's1', 'cancelled'),
        sessionAt('2026-10-17T18:00:00+03:00', 'other', 'cancelled'),
      ],
      reopened: ['s1'],
      after: [
        `past cancelled ${iso('2026-10-14T19:00:00+03:00')}`,
        `s1 scheduled ${iso('2026-10-16T19:00:00+03:00')}`,
        `other cancelled ${iso('2026-10-17T18:00:00+03:00')}`,
      ],
    },
  ];
  for (const { name, event, sessions, cancelled = [], moved = [], reopened = [], movedTo = [], after } of cases) {
    test(`${name}; a second call changes nothing`, async () => {
      const stored = sessions.map((session) => ({ ...session }));
      const service = sessionsServiceOver({ event, sessions: stored });

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
      assert.deepEqual(
        changes.movedTo.map(({ id, created }) => (created ? `${id} created` : id)),
        movedTo,
      );
      const state = () => sessionStates(stored);
      assert.deepEqual(state(), after);

      const again = await service.reconcile(EVENT_ID, TX, NOW);

      assert.deepEqual(
        { ...again, eventStatus: undefined },
        { eventStatus: undefined, cancelled: [], moved: [], reopened: [], movedTo: [] },
      );
      assert.deepEqual(state(), after);
    });
  }
});
