// Written with the help of Claude

export type SessionStatus = 'scheduled' | 'cancelled';

import type { Event, EventStatus } from './event.ts';

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

/** A session that starts at another time on its day. */
export interface MovedSession {
  /** The session that was moved; cancelled when `intoSessionId` is set. */
  sessionId: string;
  from: string;
  to: string;
  /** The session that already existed at the new start and takes this one's place, if there was one. */
  intoSessionId?: string;
}

/** What bringing an event's sessions in line with the event changed (matching.md, rule 10). */
export interface SessionChanges {
  /** Whether the event is cancelled; undefined when it does not exist. */
  eventStatus?: EventStatus;
  /** Sessions cancelled now, with the start they had. */
  cancelled: { sessionId: string; startsAt: string }[];
  moved: MovedSession[];
  /** Cancelled sessions that are scheduled again, since the event is published and still has them. */
  reopened: string[];
}
