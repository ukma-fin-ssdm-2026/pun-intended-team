// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../../catalog/services/categories.service.ts';
import { EventsService } from '../../catalog/services/events.service.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { ImagesService } from '../../images/services/images.service.ts';
import type { ImageUpload } from '../../images/types/image.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { ListingsRepository } from '../repositories/listings.repository.ts';
import type { Listing, ListingDetails, NewListing } from '../types/listing.ts';

@Injectable()
export class ListingsService {
  constructor(
    private readonly listingsRepository: ListingsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly eventsService: EventsService,
    private readonly profilesService: ProfilesService,
    private readonly imagesService: ImagesService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** Active listings from today on; past ones stay readable by id. */
  async list(page: PageRequest): Promise<Page<ListingDetails>> {
    const result = await this.listingsRepository.findActive(kyivDate(), page);
    const withDetails = await this.detailsFor(result.items);
    // A listing whose author has no profile is left out after paging, so a page can hold fewer than `limit` items, or
    // none, while `hasMore` is still true.
    return { ...result, items: result.items.flatMap((listing) => withDetails(listing) ?? []) };
  }

  async getById(id: string): Promise<ListingDetails> {
    const listing = await this.listingsRepository.findActiveById(id);
    if (!listing) {
      throw new DomainError('NOT_FOUND', 'Listing not found');
    }
    const withDetails = await this.detailsFor([listing]);
    const details = withDetails(listing);
    if (!details) {
      throw new DomainError('NOT_FOUND', 'Listing not found');
    }
    return details;
  }

  async create(accountId: string, input: NewListing): Promise<ListingDetails> {
    if (input.date < kyivDate()) {
      throw new DomainError('LISTING_DATE_IN_PAST', 'The listing date has passed');
    }
    if (!(await this.categoriesService.findActive(input.categoryId))) {
      throw new DomainError('REFERENCE_NOT_FOUND', 'Category not found');
    }
    if (input.eventId) {
      const event = await this.eventsService.find(input.eventId);
      if (!event) {
        throw new DomainError('REFERENCE_NOT_FOUND', 'Event not found');
      }
      if (event.status === 'cancelled') {
        throw new DomainError('EVENT_CANCELLED', 'The event is cancelled');
      }
    }
    const listing = await this.listingsRepository.create({
      ...input,
      eventId: input.eventId ?? null,
      authorId: accountId,
      status: 'active',
      photoId: null,
    });
    return this.withDetailsOf(listing, accountId);
  }

  /**
   * The author removes their own listing. The row stays as `removed`, since a
   * report case may point at it; someone else's listing is reported as missing.
   */
  async remove(accountId: string, id: string): Promise<void> {
    await this.requireOwnActive(accountId, id);
    await this.listingsRepository.markRemoved(id);
  }

  /** The author adds or replaces the photo of their active listing, cut to the post card's 2:1. */
  async setPhoto(accountId: string, id: string, upload: ImageUpload): Promise<ListingDetails> {
    const listing = await this.requireOwnActive(accountId, id);
    const prepared = await this.imagesService.prepare('listingPhoto', upload);
    const updated = await this.transactions.run(async (tx) => {
      const image = await this.imagesService.save(accountId, prepared, tx);
      const changed = await this.listingsRepository.setPhoto(id, image.id, tx);
      await this.imagesService.remove([listing.photoId], tx);
      return changed;
    });
    return this.withDetailsOf(updated, accountId);
  }

  /** Without a photo, nothing changes. */
  async removePhoto(accountId: string, id: string): Promise<ListingDetails> {
    const listing = await this.requireOwnActive(accountId, id);
    if (listing.photoId === null) {
      return this.withDetailsOf(listing, accountId);
    }
    const photoId = listing.photoId;
    const updated = await this.transactions.run(async (tx) => {
      const changed = await this.listingsRepository.setPhoto(id, null, tx);
      await this.imagesService.remove([photoId], tx);
      return changed;
    });
    return this.withDetailsOf(updated, accountId);
  }

  /** Listings by id in any status, removed ones included: what moderation shows of reported listings. */
  async findByIds(ids: string[]): Promise<Listing[]> {
    return ids.length > 0 ? this.listingsRepository.findByIds(ids) : [];
  }

  /** An administrator removes a reported listing (FR-028); as with the author's removal, the row stays as `removed`. */
  async removeReported(id: string): Promise<void> {
    await this.listingsRepository.markRemoved(id);
  }

  /** Someone else's listing is reported as missing. */
  private async requireOwnActive(accountId: string, id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findActiveById(id);
    if (!listing || listing.authorId !== accountId) {
      throw new DomainError('NOT_FOUND', 'Listing not found');
    }
    return listing;
  }

  /** The caller's own listing, so its author has a profile. */
  private async withDetailsOf(listing: Listing, accountId: string): Promise<ListingDetails> {
    const withDetails = await this.detailsFor([listing]);
    return required(withDetails(listing), `profile of ${accountId}`);
  }

  /**
   * Loads the authors and categories of these listings, then adds them to each listing. A listing whose author has no
   * profile gives undefined: the account may never have finished onboarding, or its profile is gone.
   */
  private async detailsFor(listings: Listing[]): Promise<(listing: Listing) => ListingDetails | undefined> {
    const [authors, allCategories] = await Promise.all([
      this.profilesService.getSummaries(listings.map((listing) => listing.authorId)),
      this.categoriesService.findAll(),
    ]);
    const photos = await this.imagesService.getRefs([
      ...listings.map((listing) => listing.photoId),
      ...[...authors.values()].map((author) => author.photoId),
    ]);
    const photoOf = (id: string | null) => (id !== null && photos.get(id)) || null;
    const categories = new Map(allCategories.map((category) => [category.id, category]));
    return (listing) => {
      const author = authors.get(listing.authorId);
      return (
        author && {
          ...listing,
          author: { ...author, photo: photoOf(author.photoId) },
          category: required(categories.get(listing.categoryId), `category ${listing.categoryId}`),
          photo: photoOf(listing.photoId),
        }
      );
    };
  }
}

/** A listing always has a category, and a new one an author profile; a missing one is a data bug, so a 500. */
function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`Listing refers to a missing ${what}`);
  }
  return value;
}
