// Written with the help of Claude
import type { Category } from '../../catalog/types/category.ts';
import type { Venue } from '../../catalog/types/venue.ts';

/** An external event in our own shape: what an adapter's `normalize` returns. */
export interface ImportedEvent {
  /** The provider's own id; with the provider id it identifies the event, so a second run updates instead of duplicating. */
  externalId: string;
  title: string;
  description: string;
  /** Name of one of our categories; the provider's adapter maps its own genres to it. */
  categoryName: string;
  venue: NewImportedVenue;
  startsAt: string;
  endsAt: string;
}

/** A record the import did not take, and why. `externalId` is null when the record had none. */
export interface SkippedRecord {
  externalId: string | null;
  reason: string;
}

export type NormalizeResult = { event: ImportedEvent } | { skip: SkippedRecord };

export interface ImportReport {
  provider: string;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: SkippedRecord[];
}

export type NewImportedVenue = Pick<Venue, 'name' | 'address' | 'location'>;

/** The fields of an imported event that a later run may change. */
export interface ImportedEventFields {
  title: string;
  description: string;
  categoryId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
}

/** An imported event as the import stores it. */
export interface ImportedEventRow extends ImportedEventFields {
  id: string;
  provider: string;
  externalId: string;
}

/** A category a provider's genre can map to. */
export type ImportCategory = Pick<Category, 'id' | 'name'>;

/** How an import run ended; the last `succeeded` run gives the "last updated" notice (FR-014). */
export type ImportRunStatus = 'succeeded' | 'failed';
