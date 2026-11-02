// Written with the help of Claude
// Conversion between the `venues` and `events` rows and the core types. The import's repository uses it, and so
// will the catalog's repositories when events and venues move to the database, so both read the rows the same way.
// No `event_sessions` row is written here: a session is created when the first user applies (data-model.md).
import type { Venue } from '../../core/catalog/types/venue.ts';
import type { ImportedEventRow } from '../../core/import/types/import.ts';
import type { Event as EventRow, Venue as VenueRow } from './generated/client.ts';

export function toVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    location: { lat: row.latitude.toNumber(), lng: row.longitude.toNumber() },
    source: row.source,
    organizationId: row.organizationId,
  };
}

/** The columns a venue's location is stored in. */
export function locationColumns({ lat, lng }: Venue['location']): { latitude: number; longitude: number } {
  return { latitude: lat, longitude: lng };
}

/** An event row the import saved; such a row always has a provider and an external id. */
export function toImportedEventRow(row: EventRow): ImportedEventRow {
  if (row.provider === null || row.externalId === null) {
    throw new Error(`Event ${row.id} was not imported`);
  }
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.externalId,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    venueId: row.venueId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  };
}
