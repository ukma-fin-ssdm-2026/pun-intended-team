// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { type EventRow, toEvent, toVenue, toVenueData } from '../../dist/infra/prisma/catalog-rows.js';
import { Prisma, type Venue as VenueRow } from '../../dist/infra/prisma/generated/client.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { aVenue, CATEGORY_ID, EVENT_ID, VENUE_ID } from './fixtures/catalog.ts';

const CREATED = new Date('2026-10-01T09:00:00Z');

/** A venue row as Prisma returns it: the coordinates are decimals, and the row has its timestamps. */
function aVenueRow(overrides: Partial<VenueRow> = {}): VenueRow {
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
function anEventRow(overrides: Partial<EventRow> = {}): EventRow {
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
    status: 'published',
    createdAt: CREATED,
    updatedAt: CREATED,
    category: { id: CATEGORY_ID, name: 'Concerts' },
    venue: aVenueRow(),
    ...overrides,
  };
}

describe('toVenue', () => {
  test('turns the decimal coordinates into numbers', () => {
    assert.deepEqual(toVenue(aVenueRow()), aVenue());
  });

  test('keeps an imported venue without an owner', () => {
    const venue = toVenue(aVenueRow({ source: 'import', organizationId: null }));

    assert.deepEqual(venue, aVenue({ source: 'import', organizationId: null }));
  });
});

describe('toVenueData', () => {
  test('splits the location into the two columns', () => {
    const { id: _id, ...venue } = aVenue();

    assert.deepEqual(toVenueData(venue), {
      name: venue.name,
      address: venue.address,
      latitude: venue.location.lat,
      longitude: venue.location.lng,
      source: venue.source,
      organizationId: venue.organizationId,
    });
  });
});

describe('toEvent', () => {
  // timestamptz keeps the instant, not the offset it was written with: 19:00+03:00 comes back as 16:00Z.
  test('writes the instants in UTC and joins the category and the venue', () => {
    assert.deepEqual(toEvent(anEventRow()), {
      id: EVENT_ID,
      title: 'Open-air film night',
      description: 'Bring a blanket.',
      category: { id: CATEGORY_ID, name: 'Concerts' },
      venue: aVenue(),
      startsAt: '2026-11-14T16:00:00.000Z',
      endsAt: '2026-11-14T18:30:00.000Z',
      source: 'organization',
      status: 'published',
      organizationId: ACCOUNT_ID,
    });
  });

  test('leaves out the columns an Event does not have', () => {
    const event = toEvent(
      anEventRow({ source: 'import', provider: 'concert_ua', externalId: '42', organizationId: null }),
    );

    assert.deepEqual(Object.keys(event).sort(), [
      'category',
      'description',
      'endsAt',
      'id',
      'organizationId',
      'source',
      'startsAt',
      'status',
      'title',
      'venue',
    ]);
    assert.equal(event.organizationId, null);
  });
});
