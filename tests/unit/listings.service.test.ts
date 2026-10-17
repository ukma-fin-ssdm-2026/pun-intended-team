// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { ListingsService } from '../../dist/core/listings/services/listings.service.js';
import type { CategoriesService } from '../../dist/core/catalog/services/categories.service.js';
import type { EventsService } from '../../dist/core/catalog/services/events.service.js';
import type { Event } from '../../dist/core/catalog/types/event.js';
import type { ListingsRepository } from '../../dist/core/listings/repositories/listings.repository.js';
import type { Listing, NewListing } from '../../dist/core/listings/types/listing.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { aCategory, anEvent, CATEGORY_ID, EVENT_ID } from './fixtures/catalog.ts';
import { useFixedClock } from './fixtures/clock.ts';

const LISTING_ID = 'd0000000-0000-4000-8000-000000000001';

function aNewListing(overrides: Partial<NewListing> = {}): NewListing {
  return {
    categoryId: CATEGORY_ID,
    eventId: EVENT_ID,
    title: 'Looking for company for an exhibition',
    description: 'Evening, coffee after.',
    date: '2026-10-22',
    ...overrides,
  };
}

/** An active listing by ACCOUNT_ID. */
function aListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: LISTING_ID,
    authorId: ACCOUNT_ID,
    categoryId: CATEGORY_ID,
    eventId: null,
    title: 'Looking for company for an exhibition',
    description: 'Evening, coffee after.',
    date: '2026-10-22',
    status: 'active',
    ...overrides,
  };
}

/** Every dependency of ListingsService as a mock; a test changes only what it needs. */
function makeService() {
  const listingsRepository = {
    findActiveById: mock.fn((): Promise<Listing | undefined> => Promise.resolve(undefined)),
    findActive: mock.fn(),
    create: mock.fn(),
    markRemoved: mock.fn(() => Promise.resolve()),
  };
  const categoriesService = {
    findActive: mock.fn(() => Promise.resolve(aCategory())),
    findAll: mock.fn(() => Promise.resolve([aCategory()])),
  };
  const eventsService = { find: mock.fn((): Promise<Event | undefined> => Promise.resolve(anEvent())) };
  const profilesService = { getSummaries: mock.fn(() => Promise.resolve(new Map())) };

  const service = new ListingsService(
    listingsRepository as unknown as ListingsRepository,
    categoriesService as unknown as CategoriesService,
    eventsService as unknown as EventsService,
    profilesService as unknown as ProfilesService,
  );
  return { service, listingsRepository, eventsService };
}

describe('ListingsService.create', () => {
  useFixedClock();

  test('rejects a listing about a cancelled event and stores nothing', async () => {
    const { service, listingsRepository, eventsService } = makeService();
    eventsService.find.mock.mockImplementation(() => Promise.resolve(anEvent({ status: 'cancelled' })));

    const creating = service.create(ACCOUNT_ID, aNewListing());

    await assert.rejects(creating, (error) => error instanceof DomainError && error.code === 'EVENT_CANCELLED');
    assert.equal(listingsRepository.create.mock.callCount(), 0);
  });
});

describe('ListingsService.remove', () => {
  test('answers NOT_FOUND to someone who is not the author, and the listing stays', async () => {
    const { service, listingsRepository } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() => Promise.resolve(aListing()));

    const removing = service.remove(OTHER_ACCOUNT_ID, LISTING_ID);

    await assert.rejects(removing, (error) => error instanceof DomainError && error.code === 'NOT_FOUND');
    assert.equal(listingsRepository.markRemoved.mock.callCount(), 0);
  });
});
