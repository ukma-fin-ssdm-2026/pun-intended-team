// Written with the help of Claude
import type { Category } from '../../catalog/types/category.ts';
import type { EventStatus } from '../../catalog/types/event.ts';
import type { Venue } from '../../catalog/types/venue.ts';

/** An external event in our own shape: what an adapter's `normalize` returns. */
export interface ImportedEvent {
  /** The provider's own id; with the provider id it identifies the event, so a second run updates instead of duplicating. */
  externalId: string;
  title: string;
  description: string;
  /** Slug of one of our categories, which never changes; the provider's adapter maps its own genres to it. */
  categorySlug: string;
  venue: ImportedVenue;
  startsAt: string;
  /** The end the provider gives; without one, the end of the start day in Europe/Kyiv, and `endTimeKnown` is false. */
  endsAt: string;
  endTimeKnown: boolean;
  /** The provider's image URL; the image itself is never downloaded. */
  imageUrl: string | null;
  /** The event's page at the provider: the attribution and the way to tickets. */
  sourceUrl: string | null;
}

/** A venue as a provider gives it; without coordinates the import looks them up (`Geocoder`). */
export type ImportedVenue = Pick<Venue, 'name' | 'address'> & {
  location: Venue['location'] | null;
};

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
  /**
   * The instants the list covers, as ISO strings: from when it was read to the end of the last day asked for. Only
   * an event of the provider that starts in between and is missing from a complete list counts as gone.
   */
  covers: { from: string; to: string };
  /**
   * How many records each part of the provider listed, e.g. per Karabas section, when it has parts. A part that
   * listed records in the last complete run and none now makes the list not complete: more likely a broken page
   * than a part with no events.
   */
  parts?: Record<string, number>;
}

/** What the last complete run of a provider read, for the checks of the next one. */
export interface CompleteRun {
  /** Records it saw: saved, or skipped only because the geocoder failed or found nothing. */
  seen: number;
  parts: Record<string, number>;
}

export interface ImportReport {
  provider: string;
  /** Whether the provider's list was complete (`FetchResult.complete`). */
  complete: boolean;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Imported events that were missing from the provider's complete list, now `cancelled`. */
  cancelled: number;
  /** Cancelled events that the provider lists again, now `published`. */
  republished: number;
  skipped: SkippedRecord[];
}

/** What one import run did: a report per provider, the providers whose run failed, and those not started. */
export interface ImportRunSummary {
  reports: ImportReport[];
  failed: { provider: string; error: string }[];
  notStarted: NotStartedRun[];
}

/** A provider's run the import did not start, since its last run started too recently (ADR-006, decision 9). */
export interface NotStartedRun {
  provider: string;
  lastStartedAt: string;
  /** The earliest time the provider's next run may start. */
  allowedFrom: string;
}

export interface RunOptions {
  /** Starts a run even when the provider's last one started too recently; for local runs only. */
  force?: boolean;
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
  endTimeKnown: boolean;
  imageUrl: string | null;
  sourceUrl: string | null;
}

/** An imported event as the import stores it. */
export interface ImportedEventRow extends ImportedEventFields {
  id: string;
  provider: string;
  externalId: string;
  status: EventStatus;
}

/** How a finished run is recorded besides its status. */
export interface RunDetails {
  /** Whether the list was complete and passed the checks, so a later run may compare itself with it. */
  complete: boolean;
  seen: number;
  parts?: Record<string, number>;
}

/** A category a provider's genre can map to, by its slug. */
export type ImportCategory = Pick<Category, 'id' | 'slug' | 'isActive'>;

/** How an import run ended; the last `succeeded` run gives the "last updated" notice (FR-014). */
export type ImportRunStatus = 'succeeded' | 'failed';
