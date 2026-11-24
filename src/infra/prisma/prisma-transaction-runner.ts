// Written with the help of Claude
import type { Transaction } from '../../core/common/transaction.ts';
import { type TransactionOptions, TransactionRunner } from '../../core/common/transaction-runner.ts';
import type { PrismaClient } from './generated/client.ts';

/**
 * A Prisma interactive transaction; a repository reads the `Transaction` it is given as the client of this. Built
 * over the connection of its process: the API's as `nearby_main`, the import's as `nearby_import`.
 */
export class PrismaTransactionRunner extends TransactionRunner {
  constructor(private readonly prisma: Pick<PrismaClient, '$transaction'>) {
    super();
  }

  run<Result>(work: (tx: Transaction) => Promise<Result>, { timeoutMs }: TransactionOptions = {}): Promise<Result> {
    return this.prisma.$transaction(
      (tx) => work(tx as unknown as Transaction),
      timeoutMs === undefined ? undefined : { timeout: timeoutMs },
    );
  }
}
