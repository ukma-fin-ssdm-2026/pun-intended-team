// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toEvent, toVenue, toVenueData } from '../../dist/infra/prisma/catalog-rows.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { aVenue, CATEGORY_ID, EVENT_ID } from './fixtures/catalog.ts';
import { anEventRow, aVenueRow } from './fixtures/catalog-rows.ts';

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
