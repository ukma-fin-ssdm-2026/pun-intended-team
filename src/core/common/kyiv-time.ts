// Written with the help of Claude
// The service covers Kyiv only, so calendar dates ("today", date filters) are Kyiv dates.
import { MINUTE_MS } from './durations.ts';

const kyivDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' });

/** The Kyiv calendar date of an instant, as YYYY-MM-DD. */
export function kyivDate(instant: Date | string = new Date()): string {
  return kyivDateFormat.format(new Date(instant));
}

/** YYYY-MM-DD plus a number of days. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', timeZoneName: 'longOffset' });

/** Kyiv's offset from UTC at an instant, in milliseconds: 2 hours in winter, 3 in summer. */
function kyivOffsetMs(instant: number): number {
  const name = offsetFormat.formatToParts(instant).find((part) => part.type === 'timeZoneName')?.value ?? '';
  const [, sign, hours, minutes] = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name) ?? [];
  return sign ? (sign === '-' ? -1 : 1) * (Number(hours) * 60 + Number(minutes)) * MINUTE_MS : 0;
}

/** The last millisecond of the Kyiv day an instant falls on, so `kyivDate` of it is still that day. */
export function kyivEndOfDay(instant: Date | string): Date {
  const utcMidnight = Date.parse(`${addDays(kyivDate(instant), 1)}T00:00:00Z`);
  // Kyiv moves its clocks at 03:00 or 04:00 local time, so the offset at UTC midnight (02:00 or 03:00 local, before
  // the change) is the offset of the Kyiv midnight just before it.
  return new Date(utcMidnight - kyivOffsetMs(utcMidnight) - 1);
}

/**
 * The instant whose Kyiv wall-clock time has the UTC digits of `utcDigits`: for a source that writes Kyiv time as
 * if it were UTC, `2026-11-11T19:00:00Z` becomes 19:00 in Kyiv, i.e. 17:00Z in winter and 16:00Z in summer.
 */
export function fromKyivWallClock(utcDigits: Date | string): Date {
  const digits = new Date(utcDigits).getTime();
  // The offset at `digits` is right except within hours of a clock change; one more step settles it.
  const guess = digits - kyivOffsetMs(digits);
  return new Date(digits - kyivOffsetMs(guess));
}
