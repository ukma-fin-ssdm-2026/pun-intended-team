// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../../catalog/services/categories.service.js';
import { EventsService } from '../../catalog/services/events.service.js';
import { DomainError } from '../../common/domain-error.js';
import { kyivDate } from '../../common/kyiv-time.js';
import type { Page, PageRequest } from '../../common/page.js';
import { ProfilesService } from '../../profiles/services/profiles.service.js';
import { ListingsRepository } from '../repositories/listings.repository.js';
import type { Listing, ListingDetails, NewListing } from '../types/listing.js';

@Injectable()
export class ListingsService {
  constructor(
    private readonly listingsRepository: ListingsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly eventsService: EventsService,
    private readonly profilesService: ProfilesService,
  ) {}

  /** Active listings from today on; past ones stay readable by id. */
  async list(page: PageRequest): Promise<Page<ListingDetails>> {
    const result = await this.listingsRepository.findActive(kyivDate(), page);
    return { ...result, items: await this.withDetails(result.items) };
  }

  async getById(id: string): Promise<ListingDetails> {
    const listing = await this.listingsRepository.findActiveById(id);
    if (!listing) {
      throw new DomainError('NOT_FOUND', 'Listing not found');
    }
    const [details] = await this.withDetails([listing]);
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
    });
    const [details] = await this.withDetails([listing]);
    return details;
  }

  /**
   * The author removes their own listing. The row stays as `removed`, since a
   * report case may point at it; someone else's listing is reported as missing.
   */
  async remove(accountId: string, id: string): Promise<void> {
    const listing = await this.listingsRepository.findActiveById(id);
    if (!listing || listing.authorId !== accountId) {
      throw new DomainError('NOT_FOUND', 'Listing not found');
    }
    await this.listingsRepository.markRemoved(id);
  }

  private async withDetails(listings: Listing[]): Promise<ListingDetails[]> {
    const [authors, allCategories] = await Promise.all([
      this.profilesService.getSummaries(listings.map((listing) => listing.authorId)),
      this.categoriesService.findAll(),
    ]);
    const categories = new Map(allCategories.map((category) => [category.id, category]));
    return listings.map((listing) => ({
      ...listing,
      author: required(authors.get(listing.authorId), `profile of ${listing.authorId}`),
      category: required(categories.get(listing.categoryId), `category ${listing.categoryId}`),
    }));
  }
}

/** A listing always has an author profile and a category; a missing one is a data bug, so a 500. */
function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`Listing refers to a missing ${what}`);
  }
  return value;
}
