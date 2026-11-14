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

  async findCategories(): Promise<ImportCategory[]> {
    return this.categories;
  }

  async failUnfinishedRuns(): Promise<void> {}

  async startRun(): Promise<string> {
    return randomUUID();
  }

  async findOtherProvidersEvents(): Promise<ImportedEventRow[]> {
    return [];
  }

  async lastRunStart(): Promise<Date | undefined> {
    return undefined;
  }

  async finishRun(): Promise<void> {}

  async lastCompleteRun(): Promise<undefined> {
    return undefined;
  }

  async saveSkipped(): Promise<void> {}

  async findVenues(): Promise<Venue[]> {
    return venues.filter((venue) => venue.source === 'import');
  }

  async updateVenueLocation(id: string, location: Venue['location']): Promise<Venue> {
    const venue = venues.find((saved) => saved.id === id);
    if (!venue) {
      throw new Error(`No venue ${id}`);
    }
    venue.location = location;
    return venue;
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
    Object.assign(event, fields, { status: 'published' });
  }

  async cancelUnseen(
    provider: string,
    seenExternalIds: string[],
    range: { from: string; to: string },
  ): Promise<number> {
    const unseen = events.filter(
      (event) =>
        event.source === 'import' &&
        event.provider === provider &&
        event.status === 'published' &&
        !seenExternalIds.includes(event.externalId ?? '') &&
        Date.parse(event.startsAt) > Date.parse(range.from) &&
        Date.parse(event.startsAt) <= Date.parse(range.to),
    );
    for (const event of unseen) {
      event.status = 'cancelled';
    }
    return unseen.length;
  }
}

function toRow(event: StoredEvent): ImportedEventRow {
  const { id, provider, externalId, title, description, categoryId, venueId, startsAt, endsAt, status } = event;
  const { imageUrl = null, sourceUrl = null } = event;
  if (provider === undefined || externalId === undefined) {
    throw new Error(`Event ${id} was not imported`);
  }
  return {
    id,
    provider,
    externalId,
    title,
    description,
    categoryId,
    venueId,
    startsAt,
    endsAt,
    imageUrl,
    sourceUrl,
    status,
  };
}
