// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addDays, kyivDate } from '../../dist/core/common/kyiv-time.js';
import { TODAY, useFixedClock } from './fixtures/clock.ts';

// Kyiv is UTC+3 in summer and UTC+2 in winter; 25 October 2026 is the day the clocks go back.
describe('kyivDate', () => {
  const cases = [
    { instant: '2026-10-15T09:00:00Z', date: '2026-10-15', title: 'gives the Kyiv date at noon' },
    { instant: '2026-10-14T21:00:00Z', date: '2026-10-15', title: 'starts the day at Kyiv midnight in summer' },
    { instant: '2026-10-14T20:59:59Z', date: '2026-10-14', title: 'keeps the day until a second before it' },
    { instant: '2026-01-14T22:00:00Z', date: '2026-01-15', title: 'starts the day at Kyiv midnight in winter' },
    { instant: '2026-01-14T21:59:59Z', date: '2026-01-14', title: 'keeps the winter day until a second before it' },
    { instant: '2026-10-24T21:00:00Z', date: '2026-10-25', title: 'starts the day the clocks go back at UTC+3' },
    { instant: '2026-10-25T21:59:59Z', date: '2026-10-25', title: 'ends the day the clocks go back at UTC+2' },
    { instant: '2026-10-15T00:30:00+03:00', date: '2026-10-15', title: 'reads an instant written with an offset' },
  ];

  for (const { instant, date, title } of cases) {
    test(title, () => {
      assert.equal(kyivDate(instant), date);
    });
  }

  describe('without an instant', () => {
    useFixedClock();

    test('gives today', () => {
      assert.equal(kyivDate(), TODAY);
    });
  });
});

describe('addDays', () => {
  const cases = [
    { date: '2026-10-15', days: 0, result: '2026-10-15', title: 'keeps the date for 0 days' },
    { date: '2026-10-15', days: -1, result: '2026-10-14', title: 'goes back for a negative number' },
    { date: '2026-10-15', days: 28, result: '2026-11-12', title: 'crosses into the next month' },
    { date: '2026-12-31', days: 1, result: '2027-01-01', title: 'crosses into the next year' },
    { date: '2028-02-28', days: 1, result: '2028-02-29', title: 'stops at 29 February in a leap year' },
    { date: '2027-02-28', days: 1, result: '2027-03-01', title: 'skips 29 February in other years' },
    {
      date: '2026-10-25',
      days: 1,
      result: '2026-10-26',
      title: 'counts the 25-hour day the clocks go back as one day',
    },
  ];

  for (const { date, days, result, title } of cases) {
    test(title, () => {
      assert.equal(addDays(date, days), result);
    });
  }
});
