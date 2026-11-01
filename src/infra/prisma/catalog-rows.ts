// Written with the help of Claude
import type { Event } from '../../core/catalog/types/event.ts';
import type { Venue } from '../../core/catalog/types/venue.ts';
import type { Prisma, Venue as VenueRow } from './generated/client.ts';

// How the catalog tables become `Event` and `Venue`, shared by the catalog's repositories and by the import's.

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

/** The columns of a new venue. Whether a venue already exists is for the caller to decide, not this function. */
export function toVenueData({ location, ...venue }: Omit<Venue, 'id'>) {
  return { ...venue, latitude: location.lat, longitude: location.lng };
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
