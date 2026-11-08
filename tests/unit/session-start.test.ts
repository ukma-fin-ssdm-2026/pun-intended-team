// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sessionCutoff, sessionStart } from '../../dist/core/catalog/services/session-start.js';

// Kyiv is UTC+3 until the clocks go back on 25 October 2026 at 04:00, UTC+2 after.
describe('sessionStart', () => {
  describe('of a single-day event', () => {
    const concert = { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-20T19:00:00.000Z' };

    test('is the event start without a day', () => {
      assert.equal(sessionStart(concert)?.toISOString(), concert.startsAt);
    });

    test('is the event start on its Kyiv date', () => {
      assert.equal(sessionStart(concert, '2026-10-20')?.toISOString(), concert.startsAt);
    });

    test('does not exist on another day', () => {
      assert.equal(sessionStart(concert, '2026-10-21'), undefined);
    });

    test('takes the Kyiv date of a start after midnight Kyiv time', () => {
      const lateShow = { startsAt: '2026-10-19T21:30:00.000Z', endsAt: '2026-10-19T23:30:00.000Z' };

      assert.equal(sessionStart(lateShow, '2026-10-20')?.toISOString(), lateShow.startsAt);
      assert.equal(sessionStart(lateShow, '2026-10-19'), undefined);
    });

    test('is one session for an event that runs past midnight', () => {
      const party = { startsAt: '2026-10-20T19:00:00.000Z', endsAt: '2026-10-20T23:00:00.000Z' };

      assert.equal(sessionStart(party)?.toISOString(), party.startsAt);
      assert.equal(sessionStart(party, '2026-10-21'), undefined);
    });
  });

  describe('of a multi-day event', () => {
    // 19:00 Kyiv every day, from 20 October (UTC+3) to 21:00 on 30 October (UTC+2).
    const exhibition = { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-30T19:00:00.000Z' };

    const cases = [
      { day: '2026-10-20', start: '2026-10-20T16:00:00.000Z', title: 'is the event start on its first day' },
      { day: '2026-10-24', start: '2026-10-24T16:00:00.000Z', title: 'keeps the time of day in summer' },
      { day: '2026-10-25', start: '2026-10-25T17:00:00.000Z', title: 'keeps it on the day the clocks go back' },
      { day: '2026-10-26', start: '2026-10-26T17:00:00.000Z', title: 'keeps it in winter' },
      { day: '2026-10-30', start: '2026-10-30T17:00:00.000Z', title: 'exists on the last day before the end' },
    ];

    for (const { day, start, title } of cases) {
      test(title, () => {
        assert.equal(sessionStart(exhibition, day)?.toISOString(), start);
      });
    }

    test('needs a day', () => {
      assert.equal(sessionStart(exhibition), undefined);
    });

    test('does not exist before the first day or after the last', () => {
      assert.equal(sessionStart(exhibition, '2026-10-19'), undefined);
      assert.equal(sessionStart(exhibition, '2026-10-31'), undefined);
    });

    test('does not exist on a last day that ends before its time of day', () => {
      const endsAtNoon = { ...exhibition, endsAt: '2026-10-30T10:00:00.000Z' };

      assert.equal(sessionStart(endsAtNoon, '2026-10-30'), undefined);
      assert.equal(sessionStart(endsAtNoon, '2026-10-29')?.toISOString(), '2026-10-29T17:00:00.000Z');
    });

    test('is a multi-day event when it ends just after its time of day the next day', () => {
      const twoDays = { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-21T16:00:01.000Z' };

      assert.equal(sessionStart(twoDays), undefined);
      assert.equal(sessionStart(twoDays, '2026-10-21')?.toISOString(), '2026-10-21T16:00:00.000Z');
    });
  });
});

// matching.md, policy: the cutoff is an hour before a session starts, or 2 hours before a session of 3 hours or more ends.
describe('sessionCutoff', () => {
  const cases = [
    {
      title: 'is an hour before a short event starts',
      event: { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-20T18:30:00.000Z' },
      start: '2026-10-20T16:00:00.000Z',
      closes: '2026-10-20T15:00:00.000Z',
    },
    {
      title: 'is 2 hours before an event of exactly 3 hours ends',
      event: { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-20T19:00:00.000Z' },
      start: '2026-10-20T16:00:00.000Z',
      closes: '2026-10-20T17:00:00.000Z',
    },
    {
      title: 'is 2 hours before midnight for a museum day without an end time',
      event: { startsAt: '2026-11-08T08:00:00.000Z', endsAt: '2026-11-08T21:59:59.999Z' },
      start: '2026-11-08T08:00:00.000Z',
      closes: '2026-11-08T19:59:59.999Z',
    },
    {
      title: 'counts a one-session event past midnight to its end',
      event: { startsAt: '2026-10-20T19:00:00.000Z', endsAt: '2026-10-21T01:00:00.000Z' },
      start: '2026-10-20T19:00:00.000Z',
      closes: '2026-10-20T23:00:00.000Z',
    },
    {
      title: "ends an earlier day of a multi-day event at the event's end time on that day",
      // 10:00 to 18:00 Kyiv every day.
      event: { startsAt: '2026-10-20T07:00:00.000Z', endsAt: '2026-10-30T16:00:00.000Z' },
      start: '2026-10-24T07:00:00.000Z',
      closes: '2026-10-24T13:00:00.000Z',
    },
    {
      title: 'ends an earlier day at midnight when the end time comes earlier in the day',
      // From 19:00 Kyiv every day to 01:00 after the last one.
      event: { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-22T22:00:00.000Z' },
      start: '2026-10-21T16:00:00.000Z',
      closes: '2026-10-21T18:59:59.999Z',
    },
    {
      title: 'ends the last day of a multi-day event with the event',
      event: { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-22T22:00:00.000Z' },
      start: '2026-10-22T16:00:00.000Z',
      closes: '2026-10-22T20:00:00.000Z',
    },
    {
      title: 'is an hour before a short daily session of a multi-day event starts',
      // A one-hour tour at 10:00 Kyiv every day.
      event: { startsAt: '2026-10-20T07:00:00.000Z', endsAt: '2026-10-24T08:00:00.000Z' },
      start: '2026-10-22T07:00:00.000Z',
      closes: '2026-10-22T06:00:00.000Z',
    },
  ];

  for (const { title, event, start, closes } of cases) {
    test(title, () => {
      assert.equal(sessionCutoff(event, new Date(start)).toISOString(), closes);
    });
  }
});
