// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { Match, MatchCancelReason, MatchRecord, MatchStatus, NewMatch } from '../types/match.ts';

export abstract class MatchesRepository {
  abstract count(): Promise<number>;

  /**
   * Holds the event's matching lock until `tx` ends. Every step that reads or changes the pool or a proposal takes it
   * first, so no application is proposed twice and no answer crosses a round (matching.md, rule 7).
   */
  abstract lockEvent(eventId: string, tx: Transaction): Promise<void>;

  /** `[user, excluded user]` of every pair kept apart at the event after a declined or expired proposal. */
  abstract findExcludedPairs(eventId: string, tx: Transaction): Promise<[string, string][]>;

  /**
   * Creates the proposal and moves both applications from the pool to `paired`. Throws, rolling `tx` back, when
   * either application has left the pool meanwhile.
   */
  abstract propose(match: NewMatch, tx: Transaction): Promise<Match>;

  abstract findById(id: string, tx?: Transaction): Promise<MatchRecord | undefined>;

  /** The user's matches with one of the statuses. */
  abstract findByUser(userId: string, statuses: MatchStatus[]): Promise<MatchRecord[]>;

  /** The application's match with one of the statuses; an application has at most one open match. */
  abstract findByApplication(
    applicationId: string,
    statuses: MatchStatus[],
    tx: Transaction,
  ): Promise<MatchRecord | undefined>;

  /** The matches with one of the statuses of any of the applications, on either side; each match once. */
  abstract findByApplications(
    applicationIds: string[],
    statuses: MatchStatus[],
    tx: Transaction,
  ): Promise<MatchRecord[]>;

  /** Moves the match from `from` to `to`. Throws, rolling `tx` back, when its status changed meanwhile. */
  abstract setStatus(id: string, from: MatchStatus, to: MatchStatus, tx: Transaction): Promise<void>;

  /**
   * Declines the pending match on behalf of `userId`: an Exclusion keeps the two apart at the event, and both
   * applications return to the pool (matching.md, rule 5).
   */
  abstract decline(match: MatchRecord, userId: string, tx: Transaction): Promise<void>;

  /** Cancels the pending match because `applicationId` is withdrawn, and returns the other one to the pool (A5). */
  abstract cancelForWithdrawal(match: MatchRecord, applicationId: string, tx: Transaction): Promise<void>;

  /**
   * Cancels the pending proposals of the applications for `reason`. The other side of such a proposal returns to
   * the pool unless it is among `applicationIds` too, as for a withdrawal (A5).
   */
  abstract cancelPending(applicationIds: string[], reason: MatchCancelReason, tx: Transaction): Promise<void>;

  /**
   * Cancels the pending matches for `reason` and returns both applications of each to the pool. Throws, rolling `tx`
   * back, when one of them was answered meanwhile.
   */
  abstract cancelAndReturnBoth(matches: MatchRecord[], reason: MatchCancelReason, tx: Transaction): Promise<void>;

  /**
   * Cancels the mutual matches for `reason`; one that is no longer mutual is left as it is. Their applications that
   * are still `paired` return to the pool.
   */
  abstract cancelMutual(matches: MatchRecord[], reason: MatchCancelReason, tx: Transaction): Promise<void>;
}
