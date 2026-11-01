// Written with the help of Claude
import type { Venue } from '../../catalog/types/venue.ts';
import type {
  ImportCategory,
  ImportedEventFields,
  ImportedEventRow,
  ImportRunStatus,
  NewImportedVenue,
} from '../types/import.ts';

/**
 * The import's storage, under the `nearby_import` database role (database-access.md): it reads the categories
 * and writes imported events, their venues, its runs and the records it skipped. The catalog reads the same
 * event and venue rows through its own repositories.
 */
export abstract class ImportedEventsRepository {
  /** Active categories, which the import may only read. */
  abstract findActiveCategories(): Promise<ImportCategory[]>;

  /** Records the start of a run and returns its id. */
  abstract startRun(provider: string): Promise<string>;

  abstract finishRun(runId: string, status: ImportRunStatus): Promise<void>;

  /** Keeps a record the run could not use, as received, with the reason (FR-015). */
  abstract saveSkipped(runId: string, raw: unknown, reason: string): Promise<void>;

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
