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
  venue: ImportedVenue;
  startsAt: string;
  endsAt: string;
  /** The provider's image URL; the image itself is never downloaded. */
  imageUrl: string | null;
  /** The event's page at the provider: the attribution and the way to tickets. */
  sourceUrl: string | null;
}

/** A venue as a provider gives it; without coordinates the import looks them up (`Geocoder`). */
export type ImportedVenue = Pick<Venue, 'name' | 'address'> & { location: Venue['location'] | null };

/** A record the import did not take, and why. `externalId` is null when the record had none. */
export interface SkippedRecord {
  externalId: string | null;
  reason: string;
}

export type NormalizeResult = { event: ImportedEvent } | { skip: SkippedRecord };

/** What an adapter's `fetch` returns. */
export interface FetchResult<Raw = unknown> {
  records: Raw[];
  /**
   * Whether the records are every event the provider lists for the window: false when a page failed, or when a
   * page limit stopped the reading early. Only a complete list can tell that an event is gone from the provider.
   */
  complete: boolean;
}

export interface ImportReport {
  provider: string;
  /** Whether the provider's list was complete (`FetchResult.complete`). */
  complete: boolean;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: SkippedRecord[];
}

/** What one import run did: a report per provider, and the providers whose run failed. */
export interface ImportRunSummary {
  reports: ImportReport[];
  failed: { provider: string; error: string }[];
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
  imageUrl: string | null;
  sourceUrl: string | null;
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
