// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventSessionsRepository } from '../../core/catalog/repositories/event-sessions.repository.ts';
import type { EventSessionRecord, OpenedSession, SessionStatus } from '../../core/catalog/types/event-session.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import type { EventSession as EventSessionRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

const withEventTimes = { event: { select: { startsAt: true, endsAt: true } } } as const;

type EventSessionWithEvent = EventSessionRow & { event: { startsAt: Date; endsAt: Date } };

@Injectable()
export class PrismaEventSessionsRepository implements EventSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateMany(
    eventId: string,
    starts: Date[],
    tx?: Transaction,
  ): Promise<OpenedSession<EventSessionRecord>[]> {
    const client = clientOf(this.prisma, tx);
    // ON CONFLICT DO NOTHING: of two first applications at once, both get the one session, and only the rows this
    // call inserted come back.
    const created = await client.eventSession.createManyAndReturn({
      data: starts.map((startsAt) => ({ eventId, startsAt })),
      skipDuplicates: true,
      select: { id: true },
    });
    const createdIds = new Set(created.map(({ id }) => id));
    const rows = await client.eventSession.findMany({
      where: { eventId, startsAt: { in: starts } },
      include: withEventTimes,
    });
    return rows.map((row) => ({ ...toEventSession(row), created: createdIds.has(row.id) }));
  }

  async findByIds(ids: string[], tx?: Transaction): Promise<EventSessionRecord[]> {
    const rows = await clientOf(this.prisma, tx).eventSession.findMany({
      where: { id: { in: ids } },
      include: withEventTimes,
    });
    return rows.map(toEventSession);
  }

  async findByEvent(eventId: string, tx?: Transaction): Promise<EventSessionRecord[]> {
    const rows = await clientOf(this.prisma, tx).eventSession.findMany({
      where: { eventId },
      include: withEventTimes,
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toEventSession);
  }

  async setStatus(ids: string[], status: SessionStatus, tx?: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).eventSession.updateMany({ where: { id: { in: ids } }, data: { status } });
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
