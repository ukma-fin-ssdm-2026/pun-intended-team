// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventSessionsRepository } from '../../core/catalog/repositories/event-sessions.repository.ts';
import type { EventSessionRecord, SessionStatus } from '../../core/catalog/types/event-session.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import type { EventSession as EventSessionRow, Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

const withEventTimes = { event: { select: { startsAt: true, endsAt: true } } } as const;

type EventSessionWithEvent = EventSessionRow & { event: { startsAt: Date; endsAt: Date } };

@Injectable()
export class PrismaEventSessionsRepository implements EventSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateMany(eventId: string, starts: Date[]): Promise<EventSessionRecord[]> {
    // ON CONFLICT DO NOTHING: of two first applications at once, both get the one session.
    await this.prisma.eventSession.createMany({
      data: starts.map((startsAt) => ({ eventId, startsAt })),
      skipDuplicates: true,
    });
    const rows = await this.prisma.eventSession.findMany({
      where: { eventId, startsAt: { in: starts } },
      include: withEventTimes,
    });
    return rows.map(toEventSession);
  }

  async findByIds(ids: string[], tx?: Transaction): Promise<EventSessionRecord[]> {
    const rows = await this.client(tx).eventSession.findMany({ where: { id: { in: ids } }, include: withEventTimes });
    return rows.map(toEventSession);
  }

  async findByEvent(eventId: string, tx?: Transaction): Promise<EventSessionRecord[]> {
    const rows = await this.client(tx).eventSession.findMany({
      where: { eventId },
      include: withEventTimes,
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toEventSession);
  }

  async setStatus(ids: string[], status: SessionStatus, tx?: Transaction): Promise<void> {
    await this.client(tx).eventSession.updateMany({ where: { id: { in: ids } }, data: { status } });
  }

  async move(id: string, startsAt: Date, tx?: Transaction): Promise<void> {
    await this.client(tx).eventSession.update({ where: { id }, data: { startsAt } });
  }

  private client(tx?: Transaction): Prisma.TransactionClient {
    return (tx as unknown as Prisma.TransactionClient | undefined) ?? this.prisma;
  }
}

function toEventSession(row: EventSessionWithEvent): EventSessionRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    event: { startsAt: row.event.startsAt.toISOString(), endsAt: row.event.endsAt.toISOString() },
  };
}
