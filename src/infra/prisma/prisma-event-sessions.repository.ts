// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventSessionsRepository } from '../../core/catalog/repositories/event-sessions.repository.ts';
import type { EventSessionRecord } from '../../core/catalog/types/event-session.ts';
import type { EventSession as EventSessionRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

const withEventTimes = { event: { select: { startsAt: true, endsAt: true } } } as const;

type EventSessionWithEvent = EventSessionRow & { event: { startsAt: Date; endsAt: Date } };

@Injectable()
export class PrismaEventSessionsRepository implements EventSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(eventId: string, startsAt: Date): Promise<EventSessionRecord> {
    // ON CONFLICT DO NOTHING: of two first applications at once, both get the one session.
    await this.prisma.eventSession.createMany({ data: [{ eventId, startsAt }], skipDuplicates: true });
    const row = await this.prisma.eventSession.findUniqueOrThrow({
      where: { eventId_startsAt: { eventId, startsAt } },
      include: withEventTimes,
    });
    return toEventSession(row);
  }

  async findByIds(ids: string[]): Promise<EventSessionRecord[]> {
    const rows = await this.prisma.eventSession.findMany({ where: { id: { in: ids } }, include: withEventTimes });
    return rows.map(toEventSession);
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
