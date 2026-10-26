// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Venue } from '../../core/catalog/types/venue.ts';
import { ImportedEventsRepository } from '../../core/import/repositories/imported-events.repository.ts';
import type { ImportedEventFields, ImportedEventRow, NewImportedVenue } from '../../core/import/types/import.ts';
import { events, type StoredEvent, venues } from './data.ts';

/** Writes into the same arrays the catalog stubs read, as the import and the catalog will share the tables. */
@Injectable()
export class StubImportedEventsRepository implements ImportedEventsRepository {
  async findVenue(name: string, address: string): Promise<Venue | undefined> {
    return venues.find((venue) => venue.source === 'import' && venue.name === name && venue.address === address);
  }

  async createVenue(input: NewImportedVenue): Promise<Venue> {
    const venue: Venue = { id: randomUUID(), ...input, source: 'import', organizationId: null };
    venues.push(venue);
    return venue;
  }

  async findEvent(provider: string, externalId: string): Promise<ImportedEventRow | undefined> {
    const event = events.find((event) => event.provider === provider && event.externalId === externalId);
    return event && toRow(event);
  }

  async createEvent(row: Omit<ImportedEventRow, 'id'>): Promise<ImportedEventRow> {
    const event: StoredEvent = {
      id: randomUUID(),
      ...row,
      source: 'import',
      status: 'published',
      organizationId: null,
    };
    events.push(event);
    return toRow(event);
  }

  async updateEvent(id: string, fields: ImportedEventFields): Promise<void> {
    const event = events.find((event) => event.id === id && event.source === 'import');
    if (!event) {
      throw new Error(`No imported event ${id}`);
    }
    Object.assign(event, fields);
  }
}

function toRow(event: StoredEvent): ImportedEventRow {
  const { id, provider, externalId, title, description, categoryId, venueId, startsAt, endsAt } = event;
  if (provider === undefined || externalId === undefined) {
    throw new Error(`Event ${id} was not imported`);
  }
  return { id, provider, externalId, title, description, categoryId, venueId, startsAt, endsAt };
}
