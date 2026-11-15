// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { MatchesRepository } from '../../core/matching/repositories/matches.repository.ts';
import {
  type Match,
  type MatchCancelReason,
  type MatchRecord,
  type MatchStatus,
  type NewMatch,
  PENDING_STATUSES,
} from '../../core/matching/types/match.ts';
import { type ApplicationWithDaysAndPlans, toApplication, withDaysAndPlans } from './application-rows.ts';
import type { Match as MatchRow, Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

const withApplications = {
  applicationA: { include: withDaysAndPlans },
  applicationB: { include: withDaysAndPlans },
} as const;

type MatchWithApplications = MatchRow & {
  applicationA: ApplicationWithDaysAndPlans;
  applicationB: ApplicationWithDaysAndPlans;
};

@Injectable()
export class PrismaMatchesRepository implements MatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async count(): Promise<number> {
    return this.prisma.match.count();
  }

  async lockEvent(eventId: string, tx: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`matching:${eventId}`}))`;
  }

  async findExcludedPairs(eventId: string, tx: Transaction): Promise<[string, string][]> {
    const rows = await clientOf(this.prisma, tx).exclusion.findMany({
      where: { eventId },
      select: { userId: true, excludedUserId: true },
    });
    return rows.map(({ userId, excludedUserId }) => [userId, excludedUserId]);
  }

  async propose(match: NewMatch, tx: Transaction): Promise<Match> {
    const client = clientOf(this.prisma, tx);
    const { count } = await client.application.updateMany({
      where: { id: { in: [match.applicationAId, match.applicationBId] }, status: 'in_pool' },
      data: { status: 'paired' },
    });
    if (count !== 2) {
      throw new Error('An application left the pool while it was being matched');
    }
    return toMatch(await client.match.create({ data: { ...match, seed: BigInt(match.seed) } }));
  }

  async findById(id: string, tx?: Transaction): Promise<MatchRecord | undefined> {
    const row = await clientOf(this.prisma, tx).match.findUnique({ where: { id }, include: withApplications });
    return row ? toMatchRecord(row) : undefined;
  }

  async findByUser(userId: string, statuses: MatchStatus[]): Promise<MatchRecord[]> {
    const rows = await this.prisma.match.findMany({
      where: { status: { in: statuses }, OR: [{ applicationA: { userId } }, { applicationB: { userId } }] },
      include: withApplications,
    });
    return rows.map(toMatchRecord);
  }

  async findByApplication(
    applicationId: string,
    statuses: MatchStatus[],
    tx: Transaction,
  ): Promise<MatchRecord | undefined> {
    const row = await clientOf(this.prisma, tx).match.findFirst({
      where: { status: { in: statuses }, OR: [{ applicationAId: applicationId }, { applicationBId: applicationId }] },
      include: withApplications,
    });
    return row ? toMatchRecord(row) : undefined;
  }

  async setStatus(id: string, from: MatchStatus, to: MatchStatus, tx: Transaction): Promise<void> {
    await this.moveFrom(clientOf(this.prisma, tx), id, [from], { status: to });
  }

  async decline(match: MatchRecord, userId: string, tx: Transaction): Promise<void> {
    const client = clientOf(this.prisma, tx);
    await this.moveFrom(client, match.id, PENDING_STATUSES, { status: 'declined' });
    const other = match.applicationA.userId === userId ? match.applicationB : match.applicationA;
    await client.exclusion.create({
      data: {
        userId,
        excludedUserId: other.userId,
        eventId: match.eventId,
        matchId: match.id,
        reason: 'declined',
      },
    });
    await client.application.updateMany({
      where: { id: { in: [match.applicationAId, match.applicationBId] }, status: 'paired' },
      data: { status: 'in_pool' },
    });
  }

  async cancelForWithdrawal(match: MatchRecord, applicationId: string, tx: Transaction): Promise<void> {
    const client = clientOf(this.prisma, tx);
    await this.moveFrom(client, match.id, PENDING_STATUSES, {
      status: 'cancelled',
      cancelReason: 'participant_withdrew',
    });
    const otherId = match.applicationAId === applicationId ? match.applicationBId : match.applicationAId;
    await client.application.updateMany({ where: { id: otherId, status: 'paired' }, data: { status: 'in_pool' } });
  }

  async cancelPending(applicationIds: string[], reason: MatchCancelReason, tx: Transaction): Promise<void> {
    const client = clientOf(this.prisma, tx);
    const pending = await client.match.findMany({
      where: {
        status: { in: PENDING_STATUSES },
        OR: [{ applicationAId: { in: applicationIds } }, { applicationBId: { in: applicationIds } }],
      },
      select: { id: true, applicationAId: true, applicationBId: true },
    });
    if (pending.length === 0) {
      return;
    }
    await client.match.updateMany({
      where: { id: { in: pending.map(({ id }) => id) }, status: { in: PENDING_STATUSES } },
      data: { status: 'cancelled', cancelReason: reason },
    });
    const others = pending
      .flatMap(({ applicationAId, applicationBId }) => [applicationAId, applicationBId])
      .filter((id) => !applicationIds.includes(id));
    await client.application.updateMany({
      where: { id: { in: others }, status: 'paired' },
      data: { status: 'in_pool' },
    });
  }

  async cancelAndReturnBoth(match: MatchRecord, reason: MatchCancelReason, tx: Transaction): Promise<void> {
    const client = clientOf(this.prisma, tx);
    await this.moveFrom(client, match.id, PENDING_STATUSES, { status: 'cancelled', cancelReason: reason });
    await client.application.updateMany({
      where: { id: { in: [match.applicationAId, match.applicationBId] }, status: 'paired' },
      data: { status: 'in_pool' },
    });
  }

  private async moveFrom(
    client: Prisma.TransactionClient,
    id: string,
    from: MatchStatus[],
    data: Prisma.MatchUpdateManyMutationInput,
  ): Promise<void> {
    const { count } = await client.match.updateMany({ where: { id, status: { in: from } }, data });
    if (count === 0) {
      throw new Error(`Match ${id} changed while it was being answered`);
    }
  }
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

function toMatchRecord(row: MatchWithApplications): MatchRecord {
  return {
    ...toMatch(row),
    eventId: row.applicationA.eventId,
    applicationA: toApplication(row.applicationA),
    applicationB: toApplication(row.applicationB),
  };
}
