// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { nextRoundAt, proposalValidUntil, roundTimes } from '../../dist/core/matching/services/rounds.js';

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

describe('roundTimes', () => {
  const sessionStartsAt = '2026-10-30T17:00:00.000Z';
  const cases = [
    {
      now: '2026-10-01T00:00:00.000Z',
      rounds: [
        '2026-10-23T17:00:00.000Z',
        '2026-10-27T17:00:00.000Z',
        '2026-10-29T17:00:00.000Z',
        '2026-10-30T11:00:00.000Z',
      ],
      title: 'are all four from far ahead',
    },
    {
      now: '2026-10-28T09:00:00.000Z',
      rounds: ['2026-10-29T17:00:00.000Z', '2026-10-30T11:00:00.000Z'],
      title: 'skip the rounds already past',
    },
    {
      now: '2026-10-27T17:00:00.000Z',
      rounds: ['2026-10-29T17:00:00.000Z', '2026-10-30T11:00:00.000Z'],
      title: 'skip a round that runs now',
    },
    { now: '2026-10-30T12:00:00.000Z', rounds: [], title: 'are none after the last round' },
  ];

  for (const { now, rounds, title } of cases) {
    test(title, () => {
      assert.deepEqual(
        roundTimes(sessionStartsAt, new Date(now)).map((round) => round.toISOString()),
        rounds,
      );
    });
  }
});

// The earliest of 24 hours, the next round on a shared day and the last shared day's cutoff (matching.md, rule 4).
describe('proposalValidUntil', () => {
  // Rounds on 23 Oct 17:00, 27 Oct 17:00, 29 Oct 17:00 and 30 Oct 11:00; the cutoff an hour before the start.
  const oneDay = [{ startsAt: '2026-10-30T17:00:00.000Z', cutoffAt: '2026-10-30T16:00:00.000Z' }];
  const cases = [
    {
      title: 'is 24 hours later when no round or cutoff comes sooner',
      createdAt: '2026-10-20T09:00:00.000Z',
      days: oneDay,
      validUntil: '2026-10-21T09:00:00.000Z',
    },
    {
      title: 'is the start of the next round when it comes within 24 hours',
      createdAt: '2026-10-23T08:00:00.000Z',
      days: oneDay,
      validUntil: '2026-10-23T17:00:00.000Z',
    },
    {
      title: 'is the cutoff after the last round',
      createdAt: '2026-10-30T11:30:00.000Z',
      days: oneDay,
      validUntil: '2026-10-30T16:00:00.000Z',
    },
    {
      title: 'is the soonest next round of any shared day',
      createdAt: '2026-11-01T18:00:00.000Z',
      // The first day's next round is on 3 Nov 17:00, the second day's on 2 Nov 11:00.
      days: [
        { startsAt: '2026-11-04T17:00:00.000Z', cutoffAt: '2026-11-04T16:00:00.000Z' },
        { startsAt: '2026-11-02T17:00:00.000Z', cutoffAt: '2026-11-02T16:00:00.000Z' },
      ],
      validUntil: '2026-11-02T11:00:00.000Z',
    },
    {
      title: 'ignores the cutoff of a shared day when a later one is left',
      createdAt: '2026-11-02T12:00:00.000Z',
      // Past the first day's last round; its cutoff at 16:00 does not end the proposal, the second day's round at
      // 17:00 does.
      days: [
        { startsAt: '2026-11-02T17:00:00.000Z', cutoffAt: '2026-11-02T16:00:00.000Z' },
        { startsAt: '2026-11-03T17:00:00.000Z', cutoffAt: '2026-11-03T16:00:00.000Z' },
      ],
      validUntil: '2026-11-02T17:00:00.000Z',
    },
  ];

  for (const { title, createdAt, days, validUntil } of cases) {
    test(title, () => {
      assert.equal(proposalValidUntil(new Date(createdAt), days).toISOString(), validUntil);
    });
  }
});
