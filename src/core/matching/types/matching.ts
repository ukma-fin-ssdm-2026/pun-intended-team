// Written with the help of Claude

/** A user waiting in the pool of one event session. */
export interface PoolMember {
  userId: string;
  interests: string[];
}

/** Two users who must never be paired, in either order (FR-020). */
export type Exclusion = readonly [string, string];

/** A proposed pair; `score` is the interest overlap of the two users. */
export interface Pairing {
  a: string;
  b: string;
  score: number;
}

/** Why a proposal was cancelled before both users answered. */
export type MatchCancelReason = 'event_cancelled' | 'participant_banned' | 'participant_withdrew';
