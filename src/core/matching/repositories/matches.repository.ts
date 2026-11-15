// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { MatchCancelReason } from '../types/matching.ts';

export abstract class MatchesRepository {
  abstract count(): Promise<number>;

  /** Cancels the proposals of the applications that are not settled yet: proposed, or accepted by one side. */
  abstract cancelOpen(applicationIds: string[], reason: MatchCancelReason, tx?: Transaction): Promise<void>;
}
