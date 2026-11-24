// Written with the help of Claude
import type { Transaction } from './transaction.ts';

export interface TransactionOptions {
  /** How long `work` may run before the transaction is rolled back; the adapter's default (5 s) when left out. */
  timeoutMs?: number;
}

/** Starts database transactions: everything done with `tx` inside `work` commits together or not at all. */
export abstract class TransactionRunner {
  /** Commits when `work` returns and rolls back when it throws, passing the error on. */
  abstract run<Result>(work: (tx: Transaction) => Promise<Result>, options?: TransactionOptions): Promise<Result>;
}
