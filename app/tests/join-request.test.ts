// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import type { ListingRequest } from '@/api/listing-requests';
import { JOIN_REQUEST_NOTE, joinRequestOf } from '@/components/announcements/join-request';

const person = {
  username: 'taras_m',
  displayName: 'тарас',
  description: '',
  occupation: '',
  age: 25,
  interests: [
    { id: 'i1', name: 'Кіно', group: 'Мистецтво' },
    { id: 'i2', name: 'Джаз', group: 'Музика' },
  ],
  photo: null,
  cover: null,
};

const request: ListingRequest = {
  id: 'r1',
  status: 'pending',
  role: 'author',
  createdAt: '2026-11-16T10:00:00.000Z',
  decidedAt: null,
  listing: { id: 'l1', title: 'Шукаю компанію на виставку', date: '2026-11-29', place: null, eventId: null },
  requester: person,
  author: { ...person, username: 'olena_k', displayName: 'Олена' },
};

describe('joinRequestOf', () => {
  test('shows the requester, their interests and the post, with the day alone without a place', () => {
    expect(joinRequestOf(request)).toEqual({
      initial: 'Т',
      photo: null,
      nameAge: 'тарас, 25',
      interests: 'Кіно · Джаз',
      post: 'Шукаю компанію на виставку',
      details: 'Нд, 29 лист',
      note: JOIN_REQUEST_NOTE,
    });
  });

  test('adds the place name to the day', () => {
    const place = { name: 'Мистецький Арсенал', address: '', location: { lat: 50.4357, lng: 30.5555 } };

    expect(joinRequestOf({ ...request, listing: { ...request.listing, place } }).details).toBe(
      'Нд, 29 лист · Мистецький Арсенал',
    );
  });
});
