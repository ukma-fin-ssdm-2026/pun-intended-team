// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { ListingsRepository } from '../../core/listings/repositories/listings.repository.ts';
import type { Listing, ListingRecord } from '../../core/listings/types/listing.ts';
import { listings } from './data.ts';
import { paginate } from './paginate.ts';

@Injectable()
export class StubListingsRepository implements ListingsRepository {
  async findActiveById(id: string): Promise<Listing | undefined> {
    return listings.find((listing) => listing.id === id && listing.status === 'active');
  }

  async findActive(fromDate: string, page: PageRequest): Promise<Page<Listing>> {
    const matching = listings
      .filter((listing) => listing.status === 'active' && listing.date >= fromDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    return paginate(matching, page);
  }

  async create(record: ListingRecord): Promise<Listing> {
    const listing: Listing = { id: randomUUID(), ...record };
    listings.push(listing);
    return listing;
  }

  async markRemoved(id: string): Promise<void> {
    const listing = listings.find((listing) => listing.id === id);
    if (listing) {
      listing.status = 'removed';
    }
  }
}
