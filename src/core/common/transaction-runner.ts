// Written with the help of Claude
import type { Transaction } from './transaction.ts';

/** Starts database transactions: everything done with `tx` inside `work` commits together or not at all. */
export abstract class TransactionRunner {
  /** Commits when `work` returns and rolls back when it throws, passing the error on. */
  abstract run<Result>(work: (tx: Transaction) => Promise<Result>): Promise<Result>;
}
