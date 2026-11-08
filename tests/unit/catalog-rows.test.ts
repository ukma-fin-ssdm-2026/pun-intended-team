// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toEvent, toVenue } from '../../dist/infra/prisma/catalog-rows.js';
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

describe('toEvent', () => {
  // timestamptz keeps the instant, not the offset it was written with: 19:00+03:00 comes back as 16:00Z.
  test('writes the instants in UTC and joins the category and the venue', () => {
    assert.deepEqual(toEvent(anEventRow()), {
      id: EVENT_ID,
      title: 'Open-air film night',
      description: 'Bring a blanket.',
      category: { id: CATEGORY_ID, name: 'Концерти' },
      venue: aVenue(),
      startsAt: '2026-11-14T16:00:00.000Z',
      endsAt: '2026-11-14T18:30:00.000Z',
      imageUrl: null,
      sourceUrl: null,
      source: 'organization',
      status: 'published',
      organizationId: ACCOUNT_ID,
    });
  });

  test('leaves out the columns an Event does not have', () => {
    const event = toEvent(
      anEventRow({ source: 'import', provider: 'karabas', externalId: '42', organizationId: null }),
    );

    assert.deepEqual(Object.keys(event).sort(), [
      'category',
      'description',
      'endsAt',
      'id',
      'imageUrl',
      'organizationId',
      'source',
      'sourceUrl',
      'startsAt',
      'status',
      'title',
      'venue',
    ]);
    assert.equal(event.organizationId, null);
  });

  test("keeps an imported event's image and page at the provider", () => {
    const event = toEvent(
      anEventRow({
        source: 'import',
        imageUrl: 'https://images.karabas.com/lama.jpg',
        sourceUrl: 'https://kyiv.karabas.com/lama-15/',
      }),
    );

    assert.equal(event.imageUrl, 'https://images.karabas.com/lama.jpg');
    assert.equal(event.sourceUrl, 'https://kyiv.karabas.com/lama-15/');
  });
});
