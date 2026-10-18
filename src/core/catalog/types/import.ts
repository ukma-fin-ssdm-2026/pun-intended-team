// Written with the help of Claude
import type { EventRecord } from './event.ts';
import type { Venue } from './venue.ts';

/** An external event in our own shape: what an adapter's `normalize` returns. */
export interface ImportedEvent {
  /** The provider's own id; with the provider id it identifies the event, so a second run updates instead of duplicating. */
  externalId: string;
  title: string;
  description: string;
  /** Name of one of our categories; the provider's adapter maps its own genres to it. */
  categoryName: string;
  venue: Pick<Venue, 'name' | 'address' | 'location'>;
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

export type ImportedEventRecord = EventRecord & { provider: string; externalId: string };
