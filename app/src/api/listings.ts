// Written with the help of Claude
import { apiClient } from './client';
import { call, type ApiResult } from './public-client';
import type { components } from './schema';

export type Listing = components['schemas']['Listing'];
export type NewListing = components['schemas']['CreateListingBody'];

// The API's largest page.
const PAGE_SIZE = 20;

// Every page of the feed, since the screen searches and filters it on the device. It never rejects: a failed request,
// or a body that is not a page of listings, comes back as a failed result, which the screen shows with a retry.
export async function loadAllListings(): Promise<ApiResult<Listing[]>> {
  try {
    const listings: Listing[] = [];
    for (;;) {
      const result = await call(() =>
        apiClient.GET('/api/v1/listings', { params: { query: { limit: PAGE_SIZE, offset: listings.length } } }),
      );
      if (!result.ok) return result;
      listings.push(...result.data.items);
      if (!result.data.page.hasMore || result.data.items.length === 0) return { ok: true, data: listings };
    }
  } catch {
    return { ok: false, status: 500 };
  }
}

export function createListing(body: NewListing) {
  return call(() => apiClient.POST('/api/v1/listings', { body }));
}

export function deleteListing(id: string) {
  return call(() => apiClient.DELETE('/api/v1/listings/{id}', { params: { path: { id } } }));
}
