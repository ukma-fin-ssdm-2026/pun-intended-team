// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventsRepository } from '../../core/catalog/repositories/events.repository.ts';
import type {
  Event,
  EventChanges,
  EventFilter,
  EventOverview,
  EventRecord,
  EventSearch,
  EventStatus,
} from '../../core/catalog/types/event.ts';
import { addDays, kyivEndOfDay } from '../../core/common/kyiv-time.ts';
import type { Page, PageRequest } from '../../core/common/page.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import { eventInclude, organizationName, toEvent } from './catalog-rows.ts';
import type { Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

@Injectable()
export class PrismaEventsRepository implements EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: Transaction): Promise<Event | undefined> {
    const event = await clientOf(this.prisma, tx).event.findUnique({ where: { id }, include: eventInclude });
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

  async findByOrganization(
    organizationId: string,
    endingAfter: Date,
    { limit, offset }: PageRequest,
  ): Promise<Page<Event>> {
    const rows = await this.prisma.event.findMany({
      where: { organizationId, endsAt: { gt: endingAfter } },
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

  async search(
    { period, search, source, status, organizationId, venueId, categoryId }: EventSearch,
    now: Date,
    { limit, offset }: PageRequest,
  ): Promise<Page<EventOverview>> {
    const order = period === 'upcoming' ? 'asc' : 'desc';
    const rows = await this.prisma.event.findMany({
      where: {
        source,
        status,
        organizationId,
        venueId,
        categoryId,
        title: search ? { contains: search, mode: 'insensitive' } : undefined,
        endsAt: period === 'upcoming' ? { gt: now } : { lte: now },
      },
      include: overviewInclude,
      orderBy: [{ startsAt: order }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toEventOverview),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async findOverview(id: string): Promise<EventOverview | undefined> {
    const row = await this.prisma.event.findUnique({ where: { id }, include: overviewInclude });
    return row ? toEventOverview(row) : undefined;
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

  async update(
    id: string,
    { startsAt, endsAt, ...changes }: EventChanges & { status?: EventStatus },
    tx?: Transaction,
  ): Promise<Event> {
    const event = await clientOf(this.prisma, tx).event.update({
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

  async setPhoto(id: string, photoId: string | null, tx?: Transaction): Promise<Event> {
    return toEvent(
      await clientOf(this.prisma, tx).event.update({ where: { id }, data: { photoId }, include: eventInclude }),
    );
  }
}

const overviewInclude = { ...eventInclude, ...organizationName } satisfies Prisma.EventInclude;

function toEventOverview(row: Prisma.EventGetPayload<{ include: typeof overviewInclude }>): EventOverview {
  return { ...toEvent(row), organization: row.organization };
}

/** The last millisecond of a Kyiv calendar date; noon UTC always falls on the same Kyiv date. */
function endOfKyivDay(date: string): Date {
  return kyivEndOfDay(`${date}T12:00:00Z`);
}
