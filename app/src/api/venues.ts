// Written with the help of Claude
import { allPages, PAGE_SIZE } from './all-pages';
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type Venue = components['schemas']['Venue'];
export type VenueBody = components['schemas']['CreateVenueBody'];

export function loadMyVenues() {
  return allPages((offset) =>
    call(() => apiClient.GET('/api/v1/me/venues', { params: { query: { limit: PAGE_SIZE, offset } } })),
  );
}

export function createVenue(body: VenueBody) {
  return call(() => apiClient.POST('/api/v1/me/venues', { body }));
}
