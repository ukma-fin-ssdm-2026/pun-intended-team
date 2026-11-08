// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { nextRoundAt } from '../../dist/core/matching/services/rounds.js';

// Rounds run 7 days, 3 days, 24 hours and 6 hours before the session starts (matching.md, policy).
describe('nextRoundAt', () => {
  const sessionStartsAt = '2026-10-30T17:00:00.000Z';
  const cases = [
    { now: '2026-10-01T00:00:00.000Z', round: '2026-10-23T17:00:00.000Z', title: 'is a week before, from far ahead' },
    { now: '2026-10-23T17:00:00.000Z', round: '2026-10-27T17:00:00.000Z', title: 'skips a round that runs now' },
    { now: '2026-10-25T09:00:00.000Z', round: '2026-10-27T17:00:00.000Z', title: 'is 3 days before, after the first' },
    { now: '2026-10-28T09:00:00.000Z', round: '2026-10-29T17:00:00.000Z', title: 'is 24 hours before' },
    { now: '2026-10-30T09:00:00.000Z', round: '2026-10-30T11:00:00.000Z', title: 'is 6 hours before' },
    { now: '2026-10-30T12:00:00.000Z', round: undefined, title: 'is none after the last round' },
  ];

  for (const { now, round, title } of cases) {
    test(title, () => {
      assert.equal(nextRoundAt(sessionStartsAt, new Date(now))?.toISOString(), round);
    });
  }

  test('counts from the current time by default', () => {
    assert.equal(nextRoundAt(new Date(Date.now() - 1000)), undefined);
  });
});
