// Written with the help of Claude
import type { Venue } from '../../catalog/types/venue.ts';
import type {
  CompleteRun,
  ImportCategory,
  ImportedEventFields,
  ImportedEventRow,
  ImportRunStatus,
  NewImportedVenue,
  RunDetails,
} from '../types/import.ts';

/**
 * The import's storage, under the `nearby_import` database role (database-access.md): it reads the categories
 * and writes imported events, their venues, its runs and the records it skipped. The catalog reads the same
 * event and venue rows through its own repositories.
 */
export abstract class ImportedEventsRepository {
  /** All categories, active or not, which the import may only read. */
  abstract findCategories(): Promise<ImportCategory[]>;

  /**
   * Marks the provider's runs that are still `running` as `failed`, leaving `finished_at` empty: a run that never
   * finished, e.g. because its process was killed or the database went away, never counts as succeeded.
   */
  abstract failUnfinishedRuns(provider: string): Promise<void>;

  /** Records the start of a run and returns its id. */
  abstract startRun(provider: string): Promise<string>;

  /** When the provider's last succeeded run started, if it ever had one. */
  abstract lastSucceededRunStart(provider: string): Promise<Date | undefined>;

  /** Records how the run ended; a succeeded run also records what it read. */
  abstract finishRun(runId: string, status: ImportRunStatus, details?: RunDetails): Promise<void>;

  /** What the provider's last succeeded run with a complete list read, if it had one. */
  abstract lastCompleteRun(provider: string): Promise<CompleteRun | undefined>;

  /** Keeps a record the run could not use, as received, with the reason (FR-015). */
  abstract saveSkipped(runId: string, raw: unknown, reason: string): Promise<void>;

  /** A venue an earlier import created (`source` import), found by its name and address. */
  abstract findVenue(name: string, address: string): Promise<Venue | undefined>;

  /** Saves a venue with `source` import and no organization. */
  abstract createVenue(venue: NewImportedVenue): Promise<Venue>;

  /** The event an earlier import saved for this provider's record, if any. */
  abstract findEvent(provider: string, externalId: string): Promise<ImportedEventRow | undefined>;

  /** Saves a new event with `source` import, no organization, published. */
  abstract createEvent(event: Omit<ImportedEventRow, 'id' | 'status'>): Promise<ImportedEventRow>;

  /** Changes an imported event and publishes it, since the provider lists it. */
  abstract updateEvent(id: string, fields: ImportedEventFields): Promise<void>;

  /**
   * Cancels the provider's published imported events that start after `from` and by `to` and are not among
   * `seenExternalIds`; organization events are never touched. Returns how many it cancelled.
   */
  abstract cancelUnseen(
    provider: string,
    seenExternalIds: string[],
    range: { from: string; to: string },
  ): Promise<number>;
}
