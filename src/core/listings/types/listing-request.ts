// Written with the help of Claude
import type { PublicProfile } from '../../profiles/types/profile.ts';
import type { Listing } from './listing.ts';

/** `pending` until the listing's author accepts or declines; a decision is final. */
export type ListingRequestStatus = 'pending' | 'accepted' | 'declined';

/** A user's "Хочу піти" on someone else's listing. */
export interface ListingRequest {
  id: string;
  listingId: string;
  requesterId: string;
  status: ListingRequestStatus;
  createdAt: string;
  /** When the author accepted or declined; null while pending. */
  decidedAt: string | null;
}

/** What a reader of a listing sees of their own request on it. */
export type OwnListingRequest = Pick<ListingRequest, 'id' | 'status'>;

/** Which side of a request the caller is on. */
export type ListingRequestRole = 'author' | 'requester';

/** The listing a request is about, as the request shows it. */
export type ListingRequestListing = Pick<Listing, 'id' | 'title' | 'date' | 'place' | 'eventId'>;

/** A public profile without the account id: what each side sees of the other before contacts (FR-019). */
export type ListingRequestPerson = Omit<PublicProfile, 'accountId'>;

/** A request as its author or requester sees it: both people's public profiles, never their contacts. */
export interface ListingRequestView {
  id: string;
  status: ListingRequestStatus;
  role: ListingRequestRole;
  createdAt: string;
  decidedAt: string | null;
  listing: ListingRequestListing;
  requester: ListingRequestPerson;
  author: ListingRequestPerson;
}
