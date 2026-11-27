// Written with the help of Claude
import type { Category } from '../../catalog/types/category.ts';
import type { ImageRef } from '../../images/types/image.ts';
import type { ProfileSummary } from '../../profiles/types/profile.ts';
import type { OwnListingRequest } from './listing-request.ts';
import type { ListingPlace } from './place.ts';

export type ListingStatus = 'active' | 'removed';

export interface Listing {
  id: string;
  authorId: string;
  categoryId: string;
  /** The catalog event the listing is about, if any. */
  eventId: string | null;
  title: string;
  description: string;
  /** Kyiv date, YYYY-MM-DD. */
  date: string;
  status: ListingStatus;
  photoId: string | null;
  /** Where the author suggests meeting; null when the listing names no place. */
  place: ListingPlace | null;
}

/** What readers see of a listing's author. */
export interface ListingAuthor extends ProfileSummary {
  photo: ImageRef | null;
}

/** A listing with what readers see of its author and category. */
export interface ListingDetails extends Listing {
  author: ListingAuthor;
  category: Pick<Category, 'id' | 'name'>;
  photo: ImageRef | null;
  /** The viewer's own request to join it; null when they have none, and always on their own listing. */
  myRequest: OwnListingRequest | null;
  likeCount: number;
  /** Whether the viewer likes it. */
  liked: boolean;
}

/** The likes of one listing as the viewer sees them. */
export interface ListingLikes {
  likeCount: number;
  liked: boolean;
}

export interface NewListing {
  categoryId: string;
  eventId?: string;
  title: string;
  description: string;
  date: string;
  place?: ListingPlace;
}

/** A new row as the repository stores it. */
export type ListingRecord = Omit<Listing, 'id'>;
