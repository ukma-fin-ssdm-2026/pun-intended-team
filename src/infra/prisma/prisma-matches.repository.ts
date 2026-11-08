// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { MatchesRepository } from '../../core/matching/repositories/matches.repository.ts';
import type { Match, NewMatch } from '../../core/matching/types/match.ts';
import type { Match as MatchRow, Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaMatchesRepository implements MatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count(): Promise<number> {
    return this.prisma.match.count();
  }

  async lockEvent(eventId: string, tx: Transaction): Promise<void> {
    await client(tx).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matching:${eventId}`}))`;
  }

  async findExcludedPairs(eventId: string, tx: Transaction): Promise<[string, string][]> {
    const rows = await client(tx).exclusion.findMany({
      where: { eventId },
      select: { userId: true, excludedUserId: true },
    });
    return rows.map(({ userId, excludedUserId }) => [userId, excludedUserId]);
  }

  async propose(match: NewMatch, tx: Transaction): Promise<Match> {
    const { count } = await client(tx).application.updateMany({
      where: { id: { in: [match.applicationAId, match.applicationBId] }, status: 'in_pool' },
      data: { status: 'paired' },
    });
    if (count !== 2) {
      throw new Error('An application left the pool while it was being matched');
    }
    return toMatch(await client(tx).match.create({ data: { ...match, seed: BigInt(match.seed) } }));
  }
}

function client(tx: Transaction): Prisma.TransactionClient {
  return tx as unknown as Prisma.TransactionClient;
}

function toMatch(row: MatchRow): Match {
  return {
    id: row.id,
    applicationAId: row.applicationAId,
    applicationBId: row.applicationBId,
    source: row.source,
    score: row.score.toNumber(),
    seed: Number(row.seed),
    status: row.status,
    validUntil: row.validUntil.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
