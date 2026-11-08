// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { TransactionRunner } from '../../core/common/transaction-runner.ts';
import { PrismaService } from './prisma.service.ts';

/** A Prisma interactive transaction; a repository reads the `Transaction` it is given as the client of this. */
@Injectable()
export class PrismaTransactionRunner extends TransactionRunner {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  run<Result>(work: (tx: Transaction) => Promise<Result>): Promise<Result> {
    return this.prisma.$transaction((tx) => work(tx as unknown as Transaction));
  }
}
