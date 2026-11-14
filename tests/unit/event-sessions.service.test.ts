// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { sessionCutoff, sessionStart } from '../../dist/core/catalog/services/session-start.js';
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
    findOrCreateMany: mock.fn((eventId: string, starts: Date[]): Promise<EventSessionRecord[]> =>
      Promise.resolve(
        starts.map((startsAt, index) => ({
          id: index === 0 ? SESSION_ID : `${SESSION_ID}-${index}`,
          eventId,
          startsAt: startsAt.toISOString(),
          status,
          event: times,
        })),
      ),
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

    const [session] = await service.open(EVENT_ID);

    assert.deepEqual(session, {
      id: SESSION_ID,
      eventId: EVENT_ID,
      startsAt: '2026-10-22T16:00:00.000Z',
      cutoffAt: '2026-10-22T15:00:00.000Z',
      status: 'scheduled',
    });
    assert.equal(eventSessionsRepository.findOrCreateMany.mock.callCount(), 1);
  });

  test('opens the session on the chosen day of a multi-day event', async () => {
    const { service } = makeService(anEvent(EXHIBITION));

    const [session] = await service.open(EVENT_ID, ['2026-10-26']);

    assert.equal(session.startsAt, '2026-10-26T17:00:00.000Z');
  });

  test('opens a long event that has started until 2 hours before its end', async () => {
    // NOW is 12:00 in Kyiv: the museum day opened at 10:00 and closes at 18:00.
    const { service } = makeService(
      anEvent({ startsAt: '2026-10-15T10:00:00+03:00', endsAt: '2026-10-15T18:00:00+03:00' }),
    );

    const [session] = await service.open(EVENT_ID);

    assert.equal(session.startsAt, '2026-10-15T07:00:00.000Z');
    assert.equal(session.cutoffAt, '2026-10-15T13:00:00.000Z');
  });

  test("opens today's long session of a multi-day event that has started", async () => {
    const { service } = makeService(
      anEvent({ startsAt: '2026-10-10T10:00:00+03:00', endsAt: '2026-10-30T18:00:00+02:00' }),
    );

    const [session] = await service.open(EVENT_ID, ['2026-10-15']);

    assert.equal(session.startsAt, '2026-10-15T07:00:00.000Z');
  });

  test('opens a later day of a multi-day event that has already started', async () => {
    const { service } = makeService(anEvent({ ...EXHIBITION, startsAt: '2026-10-10T19:00:00+03:00' }));

    const [session] = await service.open(EVENT_ID, ['2026-10-16']);

    assert.equal(session.startsAt, '2026-10-16T16:00:00.000Z');
  });

  test('opens a session for each picked day, soonest first, once per day', async () => {
    const { service, eventSessionsRepository } = makeService(anEvent(EXHIBITION));

    const sessions = await service.open(EVENT_ID, ['2026-10-26', '2026-10-24', '2026-10-26']);

    assert.deepEqual(
      sessions.map(({ startsAt }) => startsAt),
      ['2026-10-24T16:00:00.000Z', '2026-10-26T17:00:00.000Z'],
    );
    assert.equal(eventSessionsRepository.findOrCreateMany.mock.callCount(), 1, 'one batch for all the days');
    assert.equal(eventSessionsRepository.findOrCreateMany.mock.calls[0]?.arguments[1].length, 2);
  });

  test('opens no session when one of the picked days is wrong', async () => {
    const { service, eventSessionsRepository } = makeService(anEvent(EXHIBITION));

    await assert.rejects(service.open(EVENT_ID, ['2026-10-24', '2026-10-31']), rejectsWith('INVALID_SESSION_DAY'));
    assert.equal(eventSessionsRepository.findOrCreateMany.mock.callCount(), 0);
  });

  test('takes an empty list of days as none', async () => {
    const { service } = makeService();

    const [session] = await service.open(EVENT_ID, []);

    assert.equal(session?.startsAt, '2026-10-22T16:00:00.000Z');
  });

  describe('an imported run of shows', () => {
    // As Karabas writes them on the day of NOW: the start is today's show, the end the run's last show.
    /** A play at 19:00, two hours long, every day until 8 November. */
    const PLAY = { startsAt: '2026-10-15T19:00:00+03:00', endsAt: '2026-11-08T21:00:00+02:00' };
    /** A museum open 10:00–14:00 every day until 1 May. */
    const MUSEUM = { startsAt: '2026-10-15T10:00:00+03:00', endsAt: '2027-05-01T14:00:00+03:00' };
    /** A play at 19:00 every day until 12 November, of unknown length: its end is the end of its last day. */
    const UNKNOWN_END = {
      startsAt: '2026-10-15T19:00:00+03:00',
      endsAt: '2026-11-12T21:59:59.999Z',
      endTimeKnown: false,
    };
    /**
     * An ArtWizard exhibition open until 29 November without opening hours (ADR-006, decision 5): from a default
     * 12:00 today to the end of its last day, neither time known.
     */
    const EXHIBITION_RUN = {
      startsAt: '2026-10-15T12:00:00+03:00',
      startTimeKnown: false,
      endsAt: '2026-11-29T21:59:59.999Z',
      endTimeKnown: false,
    };

    const sessions: [title: string, times: Partial<Event>, day: string, startsAt: string, cutoffAt: string][] = [
      ['the first day of a play', PLAY, '2026-10-15', '2026-10-15T16:00:00.000Z', '2026-10-15T15:00:00.000Z'],
      // After the clocks go back on 25 October, 19:00 in Kyiv is 17:00Z.
      ['a middle day of a play', PLAY, '2026-10-28', '2026-10-28T17:00:00.000Z', '2026-10-28T16:00:00.000Z'],
      ['the last day of a play', PLAY, '2026-11-08', '2026-11-08T17:00:00.000Z', '2026-11-08T16:00:00.000Z'],
      // A long day: the cutoff is 2 hours before 14:00.
      ['a museum day', MUSEUM, '2026-11-01', '2026-11-01T08:00:00.000Z', '2026-11-01T10:00:00.000Z'],
      ['the last day of the window', MUSEUM, '2026-11-12', '2026-11-12T08:00:00.000Z', '2026-11-12T10:00:00.000Z'],
      // 19:00 to the end of the day is a long session: 2 hours before midnight.
      [
        'a day of a run without an end',
        UNKNOWN_END,
        '2026-10-20',
        '2026-10-20T16:00:00.000Z',
        '2026-10-20T18:59:59.999Z',
      ],
      // 12:00 to the end of the day: 2 hours before midnight, also after the clocks go back.
      [
        'the first day of an exhibition run',
        EXHIBITION_RUN,
        '2026-10-15',
        '2026-10-15T09:00:00.000Z',
        '2026-10-15T18:59:59.999Z',
      ],
      [
        'a winter day of an exhibition run',
        EXHIBITION_RUN,
        '2026-10-28',
        '2026-10-28T10:00:00.000Z',
        '2026-10-28T19:59:59.999Z',
      ],
      [
        'the last window day of an exhibition run',
        EXHIBITION_RUN,
        '2026-11-12',
        '2026-11-12T10:00:00.000Z',
        '2026-11-12T19:59:59.999Z',
      ],
    ];
    for (const [title, times, day, startsAt, cutoffAt] of sessions) {
      test(`opens ${title} at the start's time of day, with its own cutoff`, async () => {
        const { service } = makeService(anEvent(times));

        const [session] = await service.open(EVENT_ID, [day]);

        assert.deepEqual([session.startsAt, session.cutoffAt], [startsAt, cutoffAt]);
      });
    }

    test('refuses a day after the catalog window, opening none of the days', async () => {
      const { service, eventSessionsRepository } = makeService(anEvent(MUSEUM));

      await assert.rejects(
        service.open(EVENT_ID, ['2026-11-01', '2026-11-13']),
        (error: unknown) =>
          rejectsWith('INVALID_SESSION_DAY')(error) && /28 days ahead, until 2026-11-12/.test(String(error)),
      );
      assert.equal(eventSessionsRepository.findOrCreateMany.mock.callCount(), 0);
    });

    for (const [title, times, day] of [
      ['a museum', MUSEUM, '2027-04-30'],
      ['an exhibition run', EXHIBITION_RUN, '2026-11-13'],
    ] as const) {
      test(`refuses a day after the window even when ${title} goes on`, async () => {
        const { service } = makeService(anEvent(times));

        await assert.rejects(service.open(EVENT_ID, [day]), rejectsWith('INVALID_SESSION_DAY'));
      });
    }

    test('keeps the start and cutoff of a later day when the next import moves an exhibition run a day on', () => {
      const moved = { ...EXHIBITION_RUN, startsAt: '2026-10-16T12:00:00+03:00' };

      const opened = sessionStart(EXHIBITION_RUN, '2026-10-20');

      assert.deepEqual(opened, new Date('2026-10-20T09:00:00.000Z'));
      assert.deepEqual(sessionStart(moved, '2026-10-20'), opened);
      assert.deepEqual(sessionCutoff(moved, opened), sessionCutoff(EXHIBITION_RUN, opened));
      assert.equal(sessionStart(moved, '2026-10-15'), undefined, 'the day that has passed is no longer a day of it');
    });
  });

  test('still opens a single-day event after the catalog window', async () => {
    const { service } = makeService(
      anEvent({ startsAt: '2026-12-20T19:00:00+02:00', endsAt: '2026-12-20T21:00:00+02:00' }),
    );

    const [session] = await service.open(EVENT_ID);

    assert.equal(session.startsAt, '2026-12-20T17:00:00.000Z');
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

      await assert.rejects(service.open(EVENT_ID, day && [day]), rejectsWith(code));
      assert.equal(eventSessionsRepository.findOrCreateMany.mock.callCount(), 0);
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
