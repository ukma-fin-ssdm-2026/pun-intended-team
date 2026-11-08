// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { eventSessions, sessionCutoff, formatUntil } from '@/dates';

// Kyiv is UTC+3 until the clocks go back on 25 October 2026 at 04:00, UTC+2 after.
describe('eventSessions', () => {
  test('gives a single-day event one session at its start', () => {
    expect(eventSessions('2026-10-20T19:00:00+03:00', '2026-10-20T22:00:00+03:00')).toEqual([
      '2026-10-20T19:00:00+03:00',
    ]);
  });

  test('gives an event that runs past midnight one session', () => {
    expect(eventSessions('2026-10-20T22:00:00+03:00', '2026-10-21T02:00:00+03:00')).toHaveLength(1);
  });

  test('gives a multi-day event a session each day at its time of day, across the clock change', () => {
    expect(eventSessions('2026-10-23T19:00:00+03:00', '2026-10-26T21:00:00+02:00')).toEqual([
      '2026-10-23T19:00:00+03:00',
      '2026-10-24T19:00:00+03:00',
      '2026-10-25T19:00:00+02:00',
      '2026-10-26T19:00:00+02:00',
    ]);
  });

  test('leaves out a last day that ends before the time of day', () => {
    expect(eventSessions('2026-10-20T19:00:00+03:00', '2026-10-22T12:00:00+03:00')).toEqual([
      '2026-10-20T19:00:00+03:00',
      '2026-10-21T19:00:00+03:00',
    ]);
  });
});

describe('formatUntil', () => {
  const now = new Date('2026-10-20T09:00:00Z');

  test.each([
    ['2026-10-20T09:30:00Z', 'менш ніж за годину'],
    ['2026-10-20T12:00:00Z', 'через 3 год'],
    ['2026-10-21T10:00:00Z', 'завтра'],
    ['2026-10-22T10:00:00Z', 'через 2 дні'],
    ['2026-10-27T10:00:00Z', 'через 7 днів'],
  ])('says how far %s is', (iso, label) => {
    expect(formatUntil(iso, now)).toBe(label);
  });
});

// The same cases as the API's unit tests of sessionCutoff.
describe('sessionCutoff', () => {
  test.each([
    [
      'a short event an hour before its start',
      '2026-10-20T19:00:00+03:00',
      '2026-10-20T21:30:00+03:00',
      0,
      '2026-10-20T15:00:00.000Z',
    ],
    [
      'a museum day without an end time 2 hours before midnight',
      '2026-11-08T10:00:00+02:00',
      '2026-11-08T23:59:59.999+02:00',
      0,
      '2026-11-08T19:59:59.999Z',
    ],
    [
      'a one-session event past midnight 2 hours before its end',
      '2026-10-20T22:00:00+03:00',
      '2026-10-21T04:00:00+03:00',
      0,
      '2026-10-20T23:00:00.000Z',
    ],
    [
      "an earlier day of a multi-day event at the event's end time minus 2 hours",
      '2026-10-20T10:00:00+03:00',
      '2026-10-30T18:00:00+02:00',
      4,
      '2026-10-24T13:00:00.000Z',
    ],
    [
      'an earlier day 2 hours before midnight when the end time comes earlier',
      '2026-10-20T19:00:00+03:00',
      '2026-10-23T01:00:00+03:00',
      1,
      '2026-10-21T18:59:59.999Z',
    ],
    [
      'the last day of a multi-day event 2 hours before the event ends',
      '2026-10-20T19:00:00+03:00',
      '2026-10-23T01:00:00+03:00',
      2,
      '2026-10-22T20:00:00.000Z',
    ],
    [
      'a short daily session an hour before its start',
      '2026-10-20T10:00:00+03:00',
      '2026-10-24T11:00:00+03:00',
      2,
      '2026-10-22T06:00:00.000Z',
    ],
  ])('closes %s', (_title, startsAt, endsAt, index, closes) => {
    const session = eventSessions(startsAt, endsAt)[index];
    expect(new Date(sessionCutoff(startsAt, endsAt, session)).toISOString()).toBe(closes);
  });
});
