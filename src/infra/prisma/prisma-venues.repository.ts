// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { VenuesRepository } from '../../core/catalog/repositories/venues.repository.ts';
import type { Venue } from '../../core/catalog/types/venue.ts';
import { toVenue } from './catalog-rows.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaVenuesRepository implements VenuesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Venue | undefined> {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    return venue ? toVenue(venue) : undefined;
  }
}
