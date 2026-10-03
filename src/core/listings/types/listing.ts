// Written with the help of Claude
import type { Category } from '../../catalog/types/category.js';
import type { ProfileSummary } from '../../profiles/types/profile.js';

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
}

/** A listing with what readers see of its author and category. */
export interface ListingDetails extends Listing {
  author: ProfileSummary;
  category: Pick<Category, 'id' | 'name'>;
}

export interface NewListing {
  categoryId: string;
  eventId?: string;
  title: string;
  description: string;
  date: string;
}

/** A new row as the repository stores it. */
export type ListingRecord = Omit<Listing, 'id'>;
