// Written with the help of Claude
import type { EventRow } from '../../../dist/infra/prisma/catalog-rows.js';
import { Prisma, type Venue as VenueRow } from '../../../dist/infra/prisma/generated/client.js';
import { ACCOUNT_ID } from './accounts.ts';
import { CATEGORY_ID, EVENT_ID, VENUE_ID } from './catalog.ts';

const CREATED = new Date('2026-10-01T09:00:00Z');

/** A venue row as Prisma returns it: the coordinates are decimals, and the row has its timestamps. */
export function aVenueRow(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    id: VENUE_ID,
    name: 'Natalka Park lawn',
    address: 'Naberezhno-Luhova St, Kyiv',
    latitude: new Prisma.Decimal('50.4825'),
    longitude: new Prisma.Decimal('30.5181'),
    source: 'organization',
    organizationId: ACCOUNT_ID,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

/** An event row with its category and venue, as the repositories query it. */
export function anEventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: EVENT_ID,
    categoryId: CATEGORY_ID,
    venueId: VENUE_ID,
    organizationId: ACCOUNT_ID,
    source: 'organization',
    provider: null,
    externalId: null,
    title: 'Open-air film night',
    description: 'Bring a blanket.',
    startsAt: new Date('2026-11-14T16:00:00Z'),
    endsAt: new Date('2026-11-14T18:30:00Z'),
    imageUrl: null,
    sourceUrl: null,
    status: 'published',
    createdAt: CREATED,
    updatedAt: CREATED,
    category: { id: CATEGORY_ID, name: 'Concerts' },
    venue: aVenueRow(),
    ...overrides,
  };
}
