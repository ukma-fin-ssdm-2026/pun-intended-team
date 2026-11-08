// Written with the help of Claude
import type { EventSession } from '../../catalog/types/event-session.ts';
import type { CommunicationFormat } from '../../profiles/types/profile.ts';

/** What the user would do together after the event; none means only the event. */
export const afterEventPlans = ['walk', 'coffee', 'dinner'] as const;

export type AfterEventPlan = (typeof afterEventPlans)[number];

export type ApplicationStatus = 'in_pool' | 'paired' | 'paused' | 'removed' | 'withdrawn' | 'no_match' | 'cancelled';

/**
 * A user's request to be matched at one event, with their answers to the matching questions. `sessionIds` are the
 * days the user can go: one for a single-day event, any of those picked for a multi-day one (matching.md, rule 9).
 */
export interface Application {
  id: string;
  userId: string;
  eventId: string;
  sessionIds: string[];
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
  status: ApplicationStatus;
  createdAt: string;
}

export interface NewApplication {
  eventId: string;
  /** The Kyiv days of a multi-day event the user can go on; a single-day event needs none. */
  dates?: string[];
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
}

export type ApplicationRecord = Pick<
  Application,
  'userId' | 'eventId' | 'sessionIds' | 'desiredCompany' | 'afterEventPlans'
>;

/** What the owner sees: the days with their cutoffs, and when matching next and last runs for them. */
export interface ApplicationDetails extends Omit<Application, 'sessionIds'> {
  sessions: Pick<EventSession, 'startsAt' | 'cutoffAt'>[];
  /** The last day's cutoff: until then the application can be matched. */
  cutoffAt: EventSession['cutoffAt'];
  /** The earliest round still to come on any of the days; null when not waiting in the pool or none is left. */
  nextRoundAt: string | null;
}
