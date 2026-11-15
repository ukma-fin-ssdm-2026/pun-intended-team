// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { MatchesRepository } from '../../core/matching/repositories/matches.repository.ts';
import type { MatchCancelReason } from '../../core/matching/types/matching.ts';
import type { Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaMatchesRepository implements MatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count(): Promise<number> {
    return this.prisma.match.count();
  }

  async cancelOpen(applicationIds: string[], reason: MatchCancelReason, tx?: Transaction): Promise<void> {
    const client = (tx as unknown as Prisma.TransactionClient | undefined) ?? this.prisma;
    await client.match.updateMany({
      where: {
        status: { in: ['proposed', 'accepted_a', 'accepted_b'] },
        OR: [{ applicationAId: { in: applicationIds } }, { applicationBId: { in: applicationIds } }],
      },
      data: { status: 'cancelled', cancelReason: reason },
    });
  }
}
