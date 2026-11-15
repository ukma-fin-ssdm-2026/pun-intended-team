// Written with the help of Claude
import type { Transaction } from '../../core/common/transaction.ts';
import type { Prisma } from './generated/client.ts';
import type { PrismaService } from './prisma.service.ts';

/** The client a repository method runs on: the caller's transaction, or the plain client without one. */
export function clientOf(prisma: PrismaService, tx?: Transaction): Prisma.TransactionClient {
  return (tx as unknown as Prisma.TransactionClient | undefined) ?? prisma;
}
