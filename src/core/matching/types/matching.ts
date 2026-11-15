// Written with the help of Claude
import type { CommunicationFormat } from '../../profiles/types/profile.ts';
import type { AfterEventPlan } from './application.ts';

/** An interest with the heading it is shown under; a shared heading earns part of the credit of a shared interest. */
export interface PoolInterest {
  id: string;
  group: string;
}

/** A user waiting in the pool of an event, with their answers and the days they can go. */
export interface PoolMember {
  userId: string;
  interests: PoolInterest[];
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
  sessionIds: string[];
}

/** Two users who must never be paired, in either order (FR-020). */
export type Exclusion = readonly [string, string];

/** A proposed pair and its score (see pair-score.ts). */
export interface Pairing {
  a: string;
  b: string;
  score: number;
}
