// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { Match, NewMatch } from '../types/match.ts';

export abstract class MatchesRepository {
  abstract count(): Promise<number>;

  /**
   * Holds the event's matching lock until `tx` ends. The instant match and the rounds take it before they read the
   * pool, so no application is proposed twice (matching.md, rule 7).
   */
  abstract lockEvent(eventId: string, tx: Transaction): Promise<void>;

  /** `[user, excluded user]` of every pair kept apart at the event after a declined or expired proposal. */
  abstract findExcludedPairs(eventId: string, tx: Transaction): Promise<[string, string][]>;

  /**
   * Creates the proposal and moves both applications from the pool to `paired`. Throws, rolling `tx` back, when
   * either application has left the pool meanwhile.
   */
  abstract propose(match: NewMatch, tx: Transaction): Promise<Match>;
}
