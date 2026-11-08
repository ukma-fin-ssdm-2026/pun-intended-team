// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventSessionsRepository } from '../../core/catalog/repositories/event-sessions.repository.ts';
import type { EventSession } from '../../core/catalog/types/event-session.ts';
import type { EventSession as EventSessionRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaEventSessionsRepository implements EventSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(eventId: string, startsAt: Date): Promise<EventSession> {
    // ON CONFLICT DO NOTHING: of two first applications at once, both get the one session.
    await this.prisma.eventSession.createMany({ data: [{ eventId, startsAt }], skipDuplicates: true });
    const row = await this.prisma.eventSession.findUniqueOrThrow({
      where: { eventId_startsAt: { eventId, startsAt } },
    });
    return toEventSession(row);
  }

  async findByIds(ids: string[]): Promise<EventSession[]> {
    const rows = await this.prisma.eventSession.findMany({ where: { id: { in: ids } } });
    return rows.map(toEventSession);
  }
}

function toEventSession(row: EventSessionRow): EventSession {
  return { id: row.id, eventId: row.eventId, startsAt: row.startsAt.toISOString(), status: row.status };
}
