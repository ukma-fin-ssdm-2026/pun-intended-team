// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { VenuesRepository } from '../../core/catalog/repositories/venues.repository.ts';
import type { NewVenue, Venue, VenueOverview, VenueSearch } from '../../core/catalog/types/venue.ts';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { locationColumns, organizationName, toVenue } from './catalog-rows.ts';
import type { Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaVenuesRepository implements VenuesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Venue | undefined> {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    return venue ? toVenue(venue) : undefined;
  }

  async findByOrganization(organizationId: string, { limit, offset }: PageRequest): Promise<Page<Venue>> {
    const rows = await this.prisma.venue.findMany({
      where: { organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toVenue),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async search(
    { search, source, organizationId }: VenueSearch,
    { limit, offset }: PageRequest,
  ): Promise<Page<VenueOverview>> {
    const text = search ? { contains: search, mode: 'insensitive' as const } : undefined;
    const rows = await this.prisma.venue.findMany({
      where: { source, organizationId, OR: text && [{ name: text }, { address: text }] },
      include: organizationName,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toVenueOverview),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async findOverview(id: string): Promise<VenueOverview | undefined> {
    const row = await this.prisma.venue.findUnique({ where: { id }, include: organizationName });
    return row ? toVenueOverview(row) : undefined;
  }

  async create(organizationId: string, { name, address, location }: NewVenue): Promise<Venue> {
    const venue = await this.prisma.venue.create({
      data: { name, address, ...locationColumns(location), source: 'organization', organizationId },
    });
    return toVenue(venue);
  }
}

function toVenueOverview(row: Prisma.VenueGetPayload<{ include: typeof organizationName }>): VenueOverview {
  return { ...toVenue(row), organization: row.organization };
}
