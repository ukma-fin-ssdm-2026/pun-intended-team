// Written with the help of Claude
import type { EventSession } from '../../catalog/types/event-session.ts';
import type { PublicProfile } from '../../profiles/types/profile.ts';
import type { Application } from './application.ts';

export type MatchSource = 'instant' | 'round' | 'open';

export type MatchStatus = 'proposed' | 'accepted_a' | 'accepted_b' | 'mutual' | 'declined' | 'expired' | 'cancelled';

/** A proposal still waiting for the answer of one or both. */
export const PENDING_STATUSES: MatchStatus[] = ['proposed', 'accepted_a', 'accepted_b'];

/** A proposal between two applications of one event; the days they share follow from the applications. */
export interface Match {
  id: string;
  applicationAId: string;
  applicationBId: string;
  source: MatchSource;
  score: number;
  seed: number;
  status: MatchStatus;
  validUntil: string;
  createdAt: string;
}

export type NewMatch = Pick<Match, 'applicationAId' | 'applicationBId' | 'source' | 'score' | 'seed'> & {
  validUntil: Date;
};

/** A match with both its applications. */
export interface MatchRecord extends Match {
  eventId: string;
  applicationA: Application;
  applicationB: Application;
}

/**
 * The status as one participant sees it. `proposed` waits for their answer, even when the other has accepted
 * (UC-001 step 8); `accepted` waits for the other's. A pending proposal past `validUntil` is `expired`.
 */
export type MatchViewStatus = 'proposed' | 'accepted' | 'mutual' | 'declined' | 'expired' | 'cancelled';

/** What a participant sees of the other: the public profile and their answers for this event (FR-019). */
export interface MatchPartner extends Omit<PublicProfile, 'accountId'> {
  desiredCompany: Application['desiredCompany'];
  afterEventPlans: Application['afterEventPlans'];
}

/** A match as one of its participants sees it. */
export interface MatchView {
  id: string;
  eventId: string;
  /** The caller's own application. */
  applicationId: string;
  status: MatchViewStatus;
  /** The days both can go, soonest first; the two pick one of them (matching.md, rule 9). */
  days: Pick<EventSession, 'startsAt' | 'cutoffAt'>[];
  validUntil: string;
  partner: MatchPartner;
  createdAt: string;
}
