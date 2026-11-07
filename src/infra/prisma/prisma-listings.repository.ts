// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { ListingsRepository } from '../../core/listings/repositories/listings.repository.ts';
import type { Listing, ListingRecord } from '../../core/listings/types/listing.ts';
import type { Listing as ListingRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaListingsRepository implements ListingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveById(id: string): Promise<Listing | undefined> {
    const listing = await this.prisma.listing.findFirst({ where: { id, status: 'active' } });
    return listing ? toListing(listing) : undefined;
  }

  async findActive(fromDate: string, { limit, offset }: PageRequest): Promise<Page<Listing>> {
    const rows = await this.prisma.listing.findMany({
      where: { status: 'active', date: { gte: toDateColumn(fromDate) } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toListing),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async create({ date, ...record }: ListingRecord): Promise<Listing> {
    return toListing(await this.prisma.listing.create({ data: { ...record, date: toDateColumn(date) } }));
  }

  async markRemoved(id: string): Promise<void> {
    await this.prisma.listing.updateMany({ where: { id }, data: { status: 'removed' } });
  }
}

function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    authorId: row.authorId,
    categoryId: row.categoryId,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    date: row.date.toISOString().slice(0, 10),
    status: row.status,
  };
}

// A date column holds no time; Prisma reads and writes it as midnight UTC.
function toDateColumn(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
