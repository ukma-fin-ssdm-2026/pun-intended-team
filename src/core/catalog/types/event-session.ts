// Written with the help of Claude

export type SessionStatus = 'scheduled' | 'cancelled';

import type { Event } from './event.ts';

/** One day of an event that users apply to; matching rounds are anchored to its start (matching.md, rule 9). */
export interface EventSession {
  id: string;
  eventId: string;
  startsAt: string;
  /** When matching for the session stops, and with it new applications (matching.md, rule 3). */
  cutoffAt: string;
  status: SessionStatus;
}

/** A stored session with the times of its event, from which the cutoff follows. */
export interface EventSessionRecord extends Omit<EventSession, 'cutoffAt'> {
  event: Pick<Event, 'startsAt' | 'endsAt'>;
}
