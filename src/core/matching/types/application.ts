// Written with the help of Claude
import type { EventSession } from '../../catalog/types/event-session.ts';
import type { CommunicationFormat, GenderPreference } from '../../profiles/types/profile.ts';

/** What the user would do together after the event; none means only the event. */
export const afterEventPlans = ['walk', 'coffee', 'dinner'] as const;

export type AfterEventPlan = (typeof afterEventPlans)[number];

/** The youngest age a user can ask for: everyone on Nearby is 18 or older (SAFE-001). */
export const MIN_PREFERRED_AGE = 18;

/** Whom the user wants to go with: a gender or anyone, and an age range; `ageMax` null means no upper bound. */
export interface CompanyPreferences {
  preferredGender: GenderPreference;
  ageMin: number;
  ageMax: number | null;
}

export type ApplicationStatus = 'in_pool' | 'paired' | 'paused' | 'removed' | 'withdrawn' | 'no_match' | 'cancelled';

/**
 * A user's request to be matched at one event, with their answers to the matching questions. `sessionIds` are the
 * days the user can go: one for a single-day event, any of those picked for a multi-day one (matching.md, rule 9).
 */
export interface Application extends CompanyPreferences {
  id: string;
  userId: string;
  eventId: string;
  sessionIds: string[];
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
  status: ApplicationStatus;
  createdAt: string;
}

export interface NewApplication extends CompanyPreferences {
  eventId: string;
  /** The Kyiv days of a multi-day event the user can go on; a single-day event needs none. */
  dates?: string[];
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
}

export type ApplicationRecord = Pick<
  Application,
  'userId' | 'eventId' | 'sessionIds' | 'desiredCompany' | 'afterEventPlans' | keyof CompanyPreferences
>;

/** What the owner sees: the days with their cutoffs, and when matching next and last runs for them. */
export interface ApplicationDetails extends Omit<Application, 'sessionIds'> {
  sessions: Pick<EventSession, 'startsAt' | 'cutoffAt'>[];
  /** The last day's cutoff: until then the application can be matched. */
  cutoffAt: EventSession['cutoffAt'];
  /** The earliest round still to come on any of the days; null when not waiting in the pool or none is left. */
  nextRoundAt: string | null;
}
