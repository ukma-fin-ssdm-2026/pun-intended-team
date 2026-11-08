// Written with the help of Claude
import type { EventSession } from '../../catalog/types/event-session.ts';
import type { CommunicationFormat } from '../../profiles/types/profile.ts';

/** What the user would do together after the event; none means only the event. */
export const afterEventPlans = ['walk', 'coffee', 'dinner'] as const;

export type AfterEventPlan = (typeof afterEventPlans)[number];

export type ApplicationStatus = 'in_pool' | 'paired' | 'paused' | 'removed' | 'withdrawn' | 'no_match' | 'cancelled';

/** A user's request to be matched in one event session, with their answers to the matching questions. */
export interface Application {
  id: string;
  userId: string;
  sessionId: string;
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
  status: ApplicationStatus;
  createdAt: string;
}

export interface NewApplication {
  eventId: string;
  /** The Kyiv day of a multi-day event; a single-day event needs none. */
  date?: string;
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
}

export type ApplicationRecord = Pick<Application, 'userId' | 'sessionId' | 'desiredCompany' | 'afterEventPlans'>;

/** What the owner sees: the session it is in, and when the next round pairs its pool. */
export interface ApplicationDetails extends Application {
  eventId: string;
  sessionStartsAt: EventSession['startsAt'];
  /** Null when the application is not waiting in the pool or no round is left. */
  nextRoundAt: string | null;
}
