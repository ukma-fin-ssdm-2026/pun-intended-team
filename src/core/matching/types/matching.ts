// Written with the help of Claude
import type { CommunicationFormat, Gender, GenderPreference } from '../../profiles/types/profile.ts';
import type { AfterEventPlan } from './application.ts';

/** An interest with the heading it is shown under; a shared heading earns part of the credit of a shared interest. */
export interface PoolInterest {
  id: string;
  group: string;
}

/**
 * A user waiting in the pool of an event, with their answers, the days they can go, and who they are and want to go
 * with: their gender and age, and the gender and ages they accept.
 */
export interface PoolMember {
  userId: string;
  interests: PoolInterest[];
  desiredCompany: CommunicationFormat;
  afterEventPlans: AfterEventPlan[];
  sessionIds: string[];
  /** Null for a profile that has not picked one yet: such a user fits only someone who accepts anyone. */
  gender: Gender | null;
  /** Whole years on the day of the session matched for. */
  age: number;
  preferredGender: GenderPreference;
  ageMin: number;
  /** Null: no upper bound ("60+"). */
  ageMax: number | null;
}

/** Two users who must never be paired, in either order (FR-020). */
export type Exclusion = readonly [string, string];

/** A proposed pair and its score (see pair-score.ts). */
export interface Pairing {
  a: string;
  b: string;
  score: number;
}
