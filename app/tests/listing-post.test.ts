// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import type { Listing } from '@/api/listings';
import { listingToPost } from '@/components/announcements/listing-post';

const listing: Listing = {
  id: 'l1',
  author: { username: 'olena_k', displayName: 'Олена', photo: null },
  category: { id: 'c1', name: 'Виставки' },
  eventId: null,
  title: 'Шукаю компанію на виставку',
  description: '',
  date: '2026-11-28',
  status: 'active',
  photo: null,
  place: null,
};

describe('listingToPost', () => {
  test('shows the day of the plan without a place', () => {
    expect(listingToPost(listing).chips).toEqual([{ icon: 'calendar', label: expect.any(String) }]);
  });

  test('shows the place as a pin chip next to the day', () => {
    const place = { name: 'Мистецький Арсенал', address: '', location: { lat: 50.4357, lng: 30.5555 } };

    expect(listingToPost({ ...listing, place }).chips).toEqual([
      { icon: 'calendar', label: expect.any(String) },
      { icon: 'pin', label: 'Мистецький Арсенал' },
    ]);
  });
});
