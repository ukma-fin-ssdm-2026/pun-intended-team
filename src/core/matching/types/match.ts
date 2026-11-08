// Written with the help of Claude

export type MatchSource = 'instant' | 'round' | 'open';

export type MatchStatus = 'proposed' | 'accepted_a' | 'accepted_b' | 'mutual' | 'declined' | 'expired' | 'cancelled';

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
