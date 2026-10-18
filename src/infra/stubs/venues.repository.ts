// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { VenuesRepository } from '../../core/catalog/repositories/venues.repository.ts';
import type { NewImportedVenue, Venue } from '../../core/catalog/types/venue.ts';
import { venues } from './data.ts';

@Injectable()
export class StubVenuesRepository implements VenuesRepository {
  async findById(id: string): Promise<Venue | undefined> {
    return venues.find((venue) => venue.id === id);
  }

  async findImported(name: string, address: string): Promise<Venue | undefined> {
    return venues.find((venue) => venue.organizationId === null && venue.name === name && venue.address === address);
  }

  async createImported(input: NewImportedVenue): Promise<Venue> {
    const venue: Venue = { id: randomUUID(), ...input, organizationId: null };
    venues.push(venue);
    return venue;
  }
}
