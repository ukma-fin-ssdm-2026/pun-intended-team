// Written with the help of Claude
import type { ListingLikes } from '../types/listing.ts';

export abstract class ListingLikesRepository {
  /** Adds the like; a second one by the same user changes nothing. */
  abstract like(listingId: string, accountId: string): Promise<void>;

  /** Takes the like back; without one, nothing changes. */
  abstract unlike(listingId: string, accountId: string): Promise<void>;

  /**
   * How many users like each of these listings and whether the viewer is one of them, read in one query. Every id is in
   * the map, a listing nobody likes with 0.
   */
  abstract summaries(listingIds: string[], viewerId: string): Promise<Map<string, ListingLikes>>;
}
