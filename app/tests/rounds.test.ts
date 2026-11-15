// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import {
  countdownParts,
  formatSpan,
  nextRound,
  ROUND_OFFSETS_MS,
  roundOffsetTitle,
  roundsSinceApplying,
} from '@/rounds';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const start = '2026-10-18T16:00:00.000Z';
const before = (ms: number) => new Date(Date.parse(start) - ms).toISOString();

describe('nextRound', () => {
  test.each([
    [7 * DAY, 1],
    [3 * DAY, 2],
    [DAY, 3],
    [6 * HOUR, 4],
  ])('a round %d ms before the start is round %d', (offset, number) => {
    expect(nextRound([{ startsAt: start }], before(offset))).toEqual({ number, startsAt: start });
  });

  test('finds the day of a multi-day application that the round belongs to', () => {
    const later = '2026-10-19T16:00:00.000Z';
    const round = new Date(Date.parse(later) - DAY).toISOString();
    expect(nextRound([{ startsAt: start }, { startsAt: later }], round)).toEqual({ number: 3, startsAt: later });
  });

  test('is one past the last round when none is left', () => {
    expect(nextRound([{ startsAt: start }], null)).toEqual({ number: ROUND_OFFSETS_MS.length + 1, startsAt: start });
  });
});

describe('countdownParts', () => {
  test('shows days and hours while a day or more is left', () => {
    expect(countdownParts(2 * DAY + 5 * HOUR + 30 * MINUTE)).toEqual([
      { value: '2', unit: 'дні' },
      { value: '5', unit: 'год' },
    ]);
  });

  test('shows hours and minutes, without seconds, in the last day', () => {
    expect(countdownParts(9 * HOUR + 4 * MINUTE + 13_000)).toEqual([
      { value: '9', unit: 'год' },
      { value: '04', unit: 'хв' },
    ]);
  });

  test('shows only minutes in the last hour, and at least one', () => {
    expect(countdownParts(42 * MINUTE + 30_000)).toEqual([{ value: '42', unit: 'хв' }]);
    expect(countdownParts(-5000)).toEqual([{ value: '1', unit: 'хв' }]);
  });
});

describe('formatSpan', () => {
  test.each([
    [5 * DAY + 2 * HOUR, '5 днів 2 год'],
    [DAY, '1 день'],
    [15 * HOUR + 42 * MINUTE, '15 год 42 хв'],
    [3 * HOUR, '3 год'],
    [7 * MINUTE, '7 хв'],
    [20_000, '1 хв'],
  ])('%d ms reads %s', (ms, label) => {
    expect(formatSpan(ms)).toBe(label);
  });
});

describe('roundsSinceApplying', () => {
  test('leaves out the rounds held before the user applied', () => {
    expect(roundsSinceApplying(start, before(2 * DAY))).toEqual([DAY, 6 * HOUR]);
  });

  test('keeps a round held at the moment the user applied', () => {
    expect(roundsSinceApplying(start, before(3 * DAY))).toEqual([3 * DAY, DAY, 6 * HOUR]);
  });

  test('is empty once the last round has passed', () => {
    expect(roundsSinceApplying(start, before(2 * HOUR))).toEqual([]);
  });
});

test('roundOffsetTitle names a round by how long before the event it runs', () => {
  expect(ROUND_OFFSETS_MS.map(roundOffsetTitle)).toEqual([
    '7 днів до події',
    '3 дні до події',
    '24 години до події',
    '6 годин до події',
  ]);
});
