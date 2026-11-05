// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import type { Venue } from '../../core/catalog/types/venue.ts';
import { ImportedEventsRepository } from '../../core/import/repositories/imported-events.repository.ts';
import type {
  ImportCategory,
  ImportedEventFields,
  ImportedEventRow,
  NewImportedVenue,
} from '../../core/import/types/import.ts';
import { events, type StoredEvent, venues } from './data.ts';

/**
 * For the unit tests that check the catalog serves imported events: it writes into the same arrays the catalog
 * stubs read. The import itself runs on the database (`PrismaImportedEventsRepository`). Runs and skipped records
 * are not kept.
 */
export class StubImportedEventsRepository implements ImportedEventsRepository {
  constructor(private readonly categories: ImportCategory[] = []) {}

  async findActiveCategories(): Promise<ImportCategory[]> {
    return this.categories;
  }

  async startRun(): Promise<string> {
    return randomUUID();
  }

  async finishRun(): Promise<void> {}

  async saveSkipped(): Promise<void> {}

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
