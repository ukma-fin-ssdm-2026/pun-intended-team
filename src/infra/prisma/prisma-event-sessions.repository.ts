// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventSessionsRepository } from '../../core/catalog/repositories/event-sessions.repository.ts';
import type { EventSession } from '../../core/catalog/types/event-session.ts';
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
    return { id: row.id, eventId: row.eventId, startsAt: row.startsAt.toISOString(), status: row.status };
  }
}
