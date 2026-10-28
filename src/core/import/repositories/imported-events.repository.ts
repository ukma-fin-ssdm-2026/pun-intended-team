// Written with the help of Claude
import type { Venue } from '../../catalog/types/venue.ts';
import type { ImportedEventFields, ImportedEventRow, NewImportedVenue } from '../types/import.ts';

/**
 * What the import writes: imported events and their venues, under the `nearby_import` database role
 * (database-access.md). The catalog reads the same rows through its own repositories.
 */
export abstract class ImportedEventsRepository {
  /** A venue an earlier import created (`source` import), found by its name and address. */
  abstract findVenue(name: string, address: string): Promise<Venue | undefined>;

  /** Saves a venue with `source` import and no organization. */
  abstract createVenue(venue: NewImportedVenue): Promise<Venue>;

  /** The event an earlier import saved for this provider's record, if any. */
  abstract findEvent(provider: string, externalId: string): Promise<ImportedEventRow | undefined>;

  /** Saves a new event with `source` import, no organization, published. */
  abstract createEvent(event: Omit<ImportedEventRow, 'id'>): Promise<ImportedEventRow>;

  abstract updateEvent(id: string, fields: ImportedEventFields): Promise<void>;
}
