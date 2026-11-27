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
  myRequest: null,
  likeCount: 0,
  liked: false,
};

describe('listingToPost', () => {
  test("carries the user's own request, so the card keeps its state after a reload", () => {
    expect(listingToPost({ ...listing, myRequest: { id: 'r1', status: 'pending' } }).myRequest).toEqual({
      id: 'r1',
      status: 'pending',
    });
    expect(listingToPost(listing).myRequest).toBeUndefined();
  });

  test('carries the like count and whether the user likes the post', () => {
    expect(listingToPost({ ...listing, likeCount: 4, liked: true })).toMatchObject({ likeCount: 4, liked: true });
  });

  test('shows the day of the plan without a place', () => {
    expect(listingToPost(listing).chips).toEqual([{ icon: 'calendar', label: expect.any(String) }]);
  });

  test('shows the place as a pin chip next to the day', () => {
    const place = { name: 'Мистецький Арсенал', address: '', location: { lat: 50.4357, lng: 30.5555 } };

    expect(listingToPost({ ...listing, place }).hasPlace).toBe(true);
    expect(listingToPost(listing).hasPlace).toBe(false);
    expect(listingToPost({ ...listing, place }).chips).toEqual([
      { icon: 'calendar', label: expect.any(String) },
      { icon: 'pin', label: 'Мистецький Арсенал' },
    ]);
  });
});
