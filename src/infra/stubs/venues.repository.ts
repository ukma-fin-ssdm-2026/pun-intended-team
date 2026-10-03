// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { VenuesRepository } from '../../core/catalog/repositories/venues.repository.js';
import type { Venue } from '../../core/catalog/types/venue.js';
import { venues } from './data.js';

@Injectable()
export class StubVenuesRepository implements VenuesRepository {
  async findById(id: string): Promise<Venue | undefined> {
    return venues.find((venue) => venue.id === id);
  }
}
