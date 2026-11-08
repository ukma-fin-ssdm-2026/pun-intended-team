// Written with the help of Claude

export type SessionStatus = 'scheduled' | 'cancelled';

/** One day of an event that users apply to; matching rounds are anchored to its start (matching.md, rule 9). */
export interface EventSession {
  id: string;
  eventId: string;
  startsAt: string;
  status: SessionStatus;
}
