// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type ListingPlace = NonNullable<components['schemas']['Listing']['place']>;
export type PlaceDescription = components['schemas']['PlaceDescription'];

// What is at the map's centre on Д2.1: 404 when nothing is there, 503 while OpenStreetMap cannot be reached.
export function describePlace({ lat, lng }: { lat: number; lng: number }) {
  return call(() => apiClient.GET('/api/v1/places/reverse', { params: { query: { lat, lng } } }));
}
