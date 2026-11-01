// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventsRepository } from '../../core/catalog/repositories/events.repository.ts';
import type { Event, EventChanges, EventFilter, EventRecord, EventStatus } from '../../core/catalog/types/event.ts';
import { addDays, kyivEndOfDay } from '../../core/common/kyiv-time.ts';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { eventInclude, toEvent } from './catalog-rows.ts';
import { PrismaService } from './prisma.service.ts';

// Event sessions are not created here: data-model.md creates them when the first user applies.
@Injectable()
export class PrismaEventsRepository implements EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Event | undefined> {
    const event = await this.prisma.event.findUnique({ where: { id }, include: eventInclude });
    return event ? toEvent(event) : undefined;
  }

  async findPublished(filter: EventFilter, { limit, offset }: PageRequest): Promise<Page<Event>> {
    const rows = await this.prisma.event.findMany({
      where: {
        status: 'published',
        categoryId: filter.categoryId,
        venueId: filter.venueId,
        endsAt: { gt: endOfKyivDay(addDays(filter.from, -1)) },
        startsAt: { lte: endOfKyivDay(filter.to) },
      },
      include: eventInclude,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toEvent),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async countPublishedEndingAfter(instant: Date): Promise<number> {
    return this.prisma.event.count({ where: { status: 'published', endsAt: { gt: instant } } });
  }

  async create({ startsAt, endsAt, ...record }: EventRecord): Promise<Event> {
    const event = await this.prisma.event.create({
      data: { ...record, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
      include: eventInclude,
    });
    return toEvent(event);
  }

  async update(id: string, { startsAt, endsAt, ...changes }: EventChanges & { status?: EventStatus }): Promise<Event> {
    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...changes,
        startsAt: startsAt === undefined ? undefined : new Date(startsAt),
        endsAt: endsAt === undefined ? undefined : new Date(endsAt),
      },
      include: eventInclude,
    });
    return toEvent(event);
  }
}

/** The last millisecond of a Kyiv calendar date; noon UTC always falls on the same Kyiv date. */
function endOfKyivDay(date: string): Date {
  return kyivEndOfDay(`${date}T12:00:00Z`);
}
