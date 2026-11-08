// Written with the help of Claude
import { addDays, fromKyivWallClock, kyivDate, toKyivWallClock } from '../../common/kyiv-time.ts';
import type { Event } from '../types/event.ts';

/**
 * The start of the event's session on a Kyiv day (matching.md, rule 9). An event has a session on each day from its
 * start date, at its Kyiv time of day, while that is before its end. Without a day, only an event with a single
 * session has one. Undefined when the day has no session.
 */
export function sessionStart(event: Pick<Event, 'startsAt' | 'endsAt'>, day?: string): Date | undefined {
  const startsAt = new Date(event.startsAt);
  const firstDay = kyivDate(startsAt);
  if (day === undefined) {
    return onDay(event, addDays(firstDay, 1)) === undefined ? startsAt : undefined;
  }
  if (day === firstDay) return startsAt;
  return day > firstDay ? onDay(event, day) : undefined;
}

function onDay(event: Pick<Event, 'startsAt' | 'endsAt'>, day: string): Date | undefined {
  const timeOfDay = toKyivWallClock(event.startsAt).toISOString().slice(11);
  const start = fromKyivWallClock(`${day}T${timeOfDay}`);
  return start < new Date(event.endsAt) ? start : undefined;
}
