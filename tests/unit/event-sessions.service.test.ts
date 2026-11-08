// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { EventSessionsService } from '../../dist/core/catalog/services/event-sessions.service.js';
import type { EventSessionsRepository } from '../../dist/core/catalog/repositories/event-sessions.repository.js';
import type { EventsRepository } from '../../dist/core/catalog/repositories/events.repository.js';
import type { Event } from '../../dist/core/catalog/types/event.js';
import type { EventSession, EventSessionRecord } from '../../dist/core/catalog/types/event-session.js';
import { anEvent, EVENT_ID } from './fixtures/catalog.ts';
import { useFixedClock } from './fixtures/clock.ts';

const SESSION_ID = '5e000000-0000-4000-8000-000000000001';

/** 19:00 Kyiv every day from 20 to 30 October. */
const EXHIBITION = { startsAt: '2026-10-20T19:00:00+03:00', endsAt: '2026-10-30T21:00:00+02:00' };

/** `null` stands for an event that does not exist. */
function makeService(event: Event | null = anEvent(), status: EventSession['status'] = 'scheduled') {
  const eventsRepository = { findById: mock.fn(() => Promise.resolve(event ?? undefined)) };
  const times = { startsAt: event?.startsAt ?? '', endsAt: event?.endsAt ?? '' };
  const eventSessionsRepository = {
    findByIds: mock.fn((ids: string[]) =>
      Promise.resolve(
        ids.map((id) => ({ id, eventId: EVENT_ID, startsAt: '2026-10-22T16:00:00.000Z', status, event: times })),
      ),
    ),
    findOrCreate: mock.fn((eventId: string, startsAt: Date): Promise<EventSessionRecord> =>
      Promise.resolve({ id: SESSION_ID, eventId, startsAt: startsAt.toISOString(), status, event: times }),
    ),
  };
  const service = new EventSessionsService(
    eventsRepository as unknown as EventsRepository,
    eventSessionsRepository as unknown as EventSessionsRepository,
  );
  return { service, eventSessionsRepository };
}

function rejectsWith(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('EventSessionsService.open', () => {
  useFixedClock();

  test('opens the session of a single-day event at its start, with its cutoff an hour before', async () => {
    const { service, eventSessionsRepository } = makeService();

    const session = await service.open(EVENT_ID);

    assert.deepEqual(session, {
      id: SESSION_ID,
      eventId: EVENT_ID,
      startsAt: '2026-10-22T16:00:00.000Z',
      cutoffAt: '2026-10-22T15:00:00.000Z',
      status: 'scheduled',
    });
    assert.equal(eventSessionsRepository.findOrCreate.mock.callCount(), 1);
  });

  test('opens the session on the chosen day of a multi-day event', async () => {
    const { service } = makeService(anEvent(EXHIBITION));

    const session = await service.open(EVENT_ID, '2026-10-26');

    assert.equal(session.startsAt, '2026-10-26T17:00:00.000Z');
  });

  test('opens a long event that has started until 2 hours before its end', async () => {
    // NOW is 12:00 in Kyiv: the museum day opened at 10:00 and closes at 18:00.
    const { service } = makeService(
      anEvent({ startsAt: '2026-10-15T10:00:00+03:00', endsAt: '2026-10-15T18:00:00+03:00' }),
    );

    const session = await service.open(EVENT_ID);

    assert.equal(session.startsAt, '2026-10-15T07:00:00.000Z');
    assert.equal(session.cutoffAt, '2026-10-15T13:00:00.000Z');
  });

  test("opens today's long session of a multi-day event that has started", async () => {
    const { service } = makeService(
      anEvent({ startsAt: '2026-10-10T10:00:00+03:00', endsAt: '2026-10-30T18:00:00+02:00' }),
    );

    const session = await service.open(EVENT_ID, '2026-10-15');

    assert.equal(session.startsAt, '2026-10-15T07:00:00.000Z');
  });

  test('opens a later day of a multi-day event that has already started', async () => {
    const { service } = makeService(anEvent({ ...EXHIBITION, startsAt: '2026-10-10T19:00:00+03:00' }));

    const session = await service.open(EVENT_ID, '2026-10-16');

    assert.equal(session.startsAt, '2026-10-16T16:00:00.000Z');
  });

  const refusals = [
    { title: 'refuses an event that does not exist', event: null, day: undefined, code: 'NOT_FOUND' },
    {
      title: 'refuses a cancelled event',
      event: anEvent({ status: 'cancelled' }),
      day: undefined,
      code: 'EVENT_CANCELLED',
    },
    {
      title: 'refuses a multi-day event without a day',
      event: anEvent(EXHIBITION),
      day: undefined,
      code: 'INVALID_SESSION_DAY',
    },
    {
      title: 'refuses a day the event does not run on',
      event: anEvent(EXHIBITION),
      day: '2026-10-31',
      code: 'INVALID_SESSION_DAY',
    },
    {
      title: 'refuses a short event within an hour of its start',
      event: anEvent({ startsAt: '2026-10-15T12:30:00+03:00', endsAt: '2026-10-15T14:30:00+03:00' }),
      day: undefined,
      code: 'APPLICATIONS_CLOSED',
    },
    {
      title: 'refuses a short event that has started',
      event: anEvent({ startsAt: '2026-10-15T11:00:00+03:00', endsAt: '2026-10-15T13:30:00+03:00' }),
      day: undefined,
      code: 'APPLICATIONS_CLOSED',
    },
    {
      title: 'refuses a long event that ends within 2 hours',
      event: anEvent({ startsAt: '2026-10-15T08:00:00+03:00', endsAt: '2026-10-15T13:30:00+03:00' }),
      day: undefined,
      code: 'APPLICATIONS_CLOSED',
    },
    {
      title: "refuses today's short session of a multi-day event once it has started",
      event: anEvent({ startsAt: '2026-10-10T11:00:00+03:00', endsAt: '2026-10-30T12:00:00+02:00' }),
      day: '2026-10-15',
      code: 'APPLICATIONS_CLOSED',
    },
  ];

  for (const { title, event, day, code } of refusals) {
    test(title, async () => {
      const { service, eventSessionsRepository } = makeService(event);

      await assert.rejects(service.open(EVENT_ID, day), rejectsWith(code));
      assert.equal(eventSessionsRepository.findOrCreate.mock.callCount(), 0);
    });
  }

  test('refuses a session that was cancelled', async () => {
    const { service } = makeService(anEvent(), 'cancelled');

    await assert.rejects(service.open(EVENT_ID), rejectsWith('EVENT_CANCELLED'));
  });
});

describe('EventSessionsService.getByIds', () => {
  test('keys the sessions by id', async () => {
    const { service } = makeService();

    const sessions = await service.getByIds([SESSION_ID]);

    assert.deepEqual([...sessions.keys()], [SESSION_ID]);
    assert.equal(sessions.get(SESSION_ID)?.eventId, EVENT_ID);
    assert.equal(sessions.get(SESSION_ID)?.cutoffAt, '2026-10-22T15:00:00.000Z');
  });
});
