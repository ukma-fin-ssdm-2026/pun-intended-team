// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type { Transaction } from '../../common/transaction.ts';
import type { ListingRequest } from '../types/listing-request.ts';

export abstract class ListingRequestsRepository {
  /** A new pending request; a second one by the same user on the same listing is ALREADY_REQUESTED. */
  abstract create(listingId: string, requesterId: string, tx?: Transaction): Promise<ListingRequest>;

  abstract findById(id: string, tx?: Transaction): Promise<ListingRequest | undefined>;

  abstract findByListingAndRequester(listingId: string, requesterId: string): Promise<ListingRequest | undefined>;

  /** The requester's own requests on these listings, by listing id. */
  abstract findOwn(requesterId: string, listingIds: string[]): Promise<Map<string, ListingRequest>>;

  /**
   * Requests on the author's listings, pending first, newest first. Pending requests on a removed listing are left
   * out, since nobody can decide them any more.
   */
  abstract findOnListingsOf(authorId: string, page: PageRequest): Promise<Page<ListingRequest>>;

  /** Accepts or declines a pending request; undefined when it is no longer pending. */
  abstract decide(
    id: string,
    status: 'accepted' | 'declined',
    decidedAt: Date,
    tx?: Transaction,
  ): Promise<ListingRequest | undefined>;
}
