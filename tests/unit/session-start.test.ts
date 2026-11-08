// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sessionStart } from '../../dist/core/catalog/services/session-start.js';

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
