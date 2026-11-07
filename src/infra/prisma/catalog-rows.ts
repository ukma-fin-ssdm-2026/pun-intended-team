// Written with the help of Claude
// Conversion between the `venues` and `events` rows and the core types. The catalog's repositories and the import's
// use it, so both read the rows the same way.
// No `event_sessions` row is written here: a session is created when the first user applies (data-model.md).
import type { Event } from '../../core/catalog/types/event.ts';
import type { Venue } from '../../core/catalog/types/venue.ts';
import type { ImportedEventRow } from '../../core/import/types/import.ts';
import type { Event as EventTableRow, Prisma, Venue as VenueRow } from './generated/client.ts';

/** What an event query includes so that the row can become an `Event`. */
export const eventInclude = {
  category: { select: { id: true, name: true } },
  venue: true,
} satisfies Prisma.EventInclude;

export type EventRow = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

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

// timestamptz keeps the instant but not the offset it was written with, so times come back in UTC.
export function toEvent(row: EventRow): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    venue: toVenue(row.venue),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    source: row.source,
    status: row.status,
    organizationId: row.organizationId,
  };
}

/** An event row the import saved; such a row always has a provider and an external id. */
export function toImportedEventRow(row: EventTableRow): ImportedEventRow {
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
    imageUrl: row.imageUrl,
    sourceUrl: row.sourceUrl,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  };
}
