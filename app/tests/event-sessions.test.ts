// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import {
  eventSessions,
  sessionCutoff,
  formatEventDate,
  formatSessionDay,
  formatTimeRange,
  formatUntil,
  pickableSessions,
} from '@/dates';

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
      'an earlier day of a run without an end 2 hours before the end of its day, as the API',
      '2026-10-15T19:00:00+03:00',
      '2026-11-12T23:59:59.999+02:00',
      5,
      '2026-10-20T18:59:59.999Z',
    ],
    [
      'a museum day of a run until May 2 hours before it closes',
      '2026-10-15T10:00:00+03:00',
      '2027-05-01T14:00:00+03:00',
      17,
      '2026-11-01T10:00:00.000Z',
    ],
    [
      'the last day of a run until May in summer time',
      '2026-10-15T10:00:00+03:00',
      '2027-05-01T14:00:00+03:00',
      198,
      '2027-05-01T09:00:00.000Z',
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

describe('formatTimeRange', () => {
  test.each([
    ['gives the start and the end', '2026-10-20T19:00:00+03:00', '2026-10-20T21:30:00+03:00', true, '19:00 – 21:30'],
    [
      'gives only the start when the end is unknown',
      '2026-11-08T10:00:00+02:00',
      '2026-11-08T21:59:59.999Z',
      false,
      'з 10:00',
    ],
    [
      'goes by the flag, not by an end at the last millisecond of the day',
      '2026-11-08T20:00:00+02:00',
      '2026-11-08T21:59:59.999Z',
      true,
      '20:00 – 23:59',
    ],
    ['keeps an end at midnight', '2026-11-08T20:00:00+02:00', '2026-11-08T22:00:00.000Z', true, '20:00 – 00:00'],
  ])('%s', (_title, startsAt, endsAt, endTimeKnown, label) => {
    expect(formatTimeRange({ startsAt, startTimeKnown: true, endsAt, endTimeKnown })).toBe(label);
  });

  // An exhibition run without opening hours: a default 12:00 start, the end of its last day (ADR-006, decision 5).
  test.each([
    ['gives only the last day of a run whose start time is a default', '2026-11-29T21:59:59.999Z', 'до 29 листопада'],
    ['gives nothing for a single day whose start time is a default', '2026-11-03T21:59:59.999Z', ''],
  ])('%s', (_title, endsAt, label) => {
    const run = { startsAt: '2026-11-03T12:00:00+02:00', startTimeKnown: false, endsAt, endTimeKnown: false };

    expect(formatTimeRange(run)).toBe(label);
  });
});

describe('the date of an event or a session', () => {
  const noon = '2026-11-03T12:00:00+02:00';

  test.each([
    ['a catalog card', formatEventDate, 'Вт, 3 лист · 12:00'],
    ['a mutual match', formatSessionDay, 'Вт, 3 лист, 12:00'],
  ])('gives the time on %s only when it is known', (_where, format, withTime) => {
    expect([format(noon, true), format(noon, false)]).toEqual([withTime, 'Вт, 3 лист']);
  });
});

// As the API's EventSessionsService.open: days within today and the next 28, before their cutoff.
describe('pickableSessions', () => {
  // 12:00 in Kyiv on 15 October; the catalog window ends on 12 November.
  const now = new Date('2026-10-15T09:00:00Z');

  test('offers a run of shows until May for the coming four weeks only', () => {
    const museum = ['2026-10-15T10:00:00+03:00', '2027-05-01T14:00:00+03:00'] as const;

    const days = pickableSessions(...museum, now);

    expect(eventSessions(...museum)).toHaveLength(199);
    // Today's museum day closed for applications at 12:00, 2 hours before it closes.
    expect(days).toHaveLength(28);
    expect(days[0]).toBe('2026-10-16T10:00:00+03:00');
    expect(days[days.length - 1]).toBe('2026-11-12T10:00:00+02:00');
  });

  test('offers today and every later day of a run that ends within the window', () => {
    const days = pickableSessions('2026-10-15T19:00:00+03:00', '2026-11-08T21:00:00+02:00', now);

    expect(days).toHaveLength(25);
    expect(days[0]).toBe('2026-10-15T19:00:00+03:00');
    expect(days[days.length - 1]).toBe('2026-11-08T19:00:00+02:00');
  });

  test('offers nothing of a run that starts after the window', () => {
    expect(pickableSessions('2026-11-13T19:00:00+02:00', '2026-11-20T21:00:00+02:00', now)).toEqual([]);
  });
});
