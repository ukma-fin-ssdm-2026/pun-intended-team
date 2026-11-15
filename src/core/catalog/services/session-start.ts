// Written with the help of Claude
import { catalogWindow } from '../../common/catalog-window.ts';
import { HOUR_MS } from '../../common/durations.ts';
import { addDays, fromKyivWallClock, kyivDate, kyivEndOfDay, toKyivWallClock } from '../../common/kyiv-time.ts';
import type { Event } from '../types/event.ts';

// matching.md, policy: the cutoff is an hour before a session starts; a session this long, such as a museum day, has
// its cutoff 2 hours before it ends instead.
const CUTOFF_BEFORE_START_MS = HOUR_MS;
const LONG_SESSION_MS = 3 * HOUR_MS;
const CUTOFF_BEFORE_END_MS = 2 * HOUR_MS;

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

/**
 * When matching for a session stops, and with it new applications: an hour before it starts, or for a long session 2
 * hours before it ends. The last session ends with the event; an earlier day's session ends at the event's Kyiv end
 * time on that day, or at the end of the day when the end time comes earlier in the day.
 */
export function sessionCutoff(event: Pick<Event, 'startsAt' | 'endsAt'>, start: Date): Date {
  const end = sessionEnd(event, start);
  return end.getTime() - start.getTime() >= LONG_SESSION_MS
    ? new Date(end.getTime() - CUTOFF_BEFORE_END_MS)
    : new Date(start.getTime() - CUTOFF_BEFORE_START_MS);
}

/**
 * Whether a session starting at `start` is still ahead at `now`: it has not started, or it is a long one that still
 * takes applications. Only such sessions are changed when their event changes.
 */
export function sessionAhead(event: Pick<Event, 'startsAt' | 'endsAt'>, start: Date, now: Date): boolean {
  return start > now || sessionCutoff(event, start) > now;
}

/**
 * Whether changing the event's times from `previous` to `next` changes a session that may exist and is still ahead:
 * one of a day of `previous` that `next` starts at another time, or not at all. Days are checked from yesterday,
 * whose session may run past midnight, to the end of the catalog window, the last day a session can exist for.
 * A run whose first day moves forward keeps the starts of its later days, so nothing changes for it.
 */
export function sessionScheduleChanged(
  previous: Pick<Event, 'startsAt' | 'endsAt'>,
  next: Pick<Event, 'startsAt' | 'endsAt'>,
  now: Date,
): boolean {
  const lastDay = catalogWindow(now).to;
  for (let day = addDays(kyivDate(now), -1); day <= lastDay; day = addDays(day, 1)) {
    const before = sessionStart(previous, day);
    if (before && sessionAhead(previous, before, now) && sessionStart(next, day)?.getTime() !== before.getTime()) {
      return true;
    }
  }
  return false;
}

function sessionEnd(event: Pick<Event, 'startsAt' | 'endsAt'>, start: Date): Date {
  const eventEnd = new Date(event.endsAt);
  if (onDay(event, addDays(kyivDate(start), 1)) === undefined) return eventEnd;
  const endTimeOfDay = toKyivWallClock(eventEnd).toISOString().slice(11);
  const onItsDay = fromKyivWallClock(`${kyivDate(start)}T${endTimeOfDay}`);
  return onItsDay > start ? onItsDay : kyivEndOfDay(start);
}

function onDay(event: Pick<Event, 'startsAt' | 'endsAt'>, day: string): Date | undefined {
  const timeOfDay = toKyivWallClock(event.startsAt).toISOString().slice(11);
  const start = fromKyivWallClock(`${day}T${timeOfDay}`);
  return start < new Date(event.endsAt) ? start : undefined;
}
