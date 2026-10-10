// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type { Listing, ListingRecord } from '../types/listing.ts';

export abstract class ListingsRepository {
  abstract findActiveById(id: string): Promise<Listing | undefined>;

  /** Active listings dated on or after the given Kyiv date, soonest first. */
  abstract findActive(fromDate: string, page: PageRequest): Promise<Page<Listing>>;

  abstract create(listing: ListingRecord): Promise<Listing>;

  abstract markRemoved(id: string): Promise<void>;
}
