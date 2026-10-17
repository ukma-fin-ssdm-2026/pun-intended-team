// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
// Node runs this file as it is, but ListingsService needs compiling (decorators), so the code under test
// comes from dist/ (built by `npm run test:unit`); the types come from src/ and are erased.
import { DomainError } from '../../dist/core/common/domain-error.js';
import { ListingsService } from '../../dist/core/listings/services/listings.service.js';
import type { CategoriesService } from '../../src/core/catalog/services/categories.service.ts';
import type { EventsService } from '../../src/core/catalog/services/events.service.ts';
import type { Event } from '../../src/core/catalog/types/event.ts';
import type { ListingsRepository } from '../../src/core/listings/repositories/listings.repository.ts';
import type { Listing, NewListing } from '../../src/core/listings/types/listing.ts';
import type { ProfilesService } from '../../src/core/profiles/services/profiles.service.ts';

const AUTHOR = 'a1b2c3d4-0000-4000-8000-000000000001';
const SOMEONE_ELSE = 'a1b2c3d4-0000-4000-8000-000000000002';
const CATEGORY = { id: 'c0000000-0000-4000-8000-000000000001', name: 'Exhibitions', isActive: true };

const newListing: NewListing = {
  categoryId: CATEGORY.id,
  eventId: 'e0000000-0000-4000-8000-000000000001',
  title: 'Looking for company for an exhibition',
  description: 'Evening, coffee after.',
  date: '2099-01-01',
};

const authorsListing: Listing = {
  id: 'l0000000-0000-4000-8000-000000000001',
  authorId: AUTHOR,
  categoryId: CATEGORY.id,
  eventId: null,
  title: 'Looking for company for an exhibition',
  description: 'Evening, coffee after.',
  date: '2099-01-01',
  status: 'active',
};

/** Every dependency of ListingsService as a mock; a test changes only what it needs. */
function makeService() {
  const listingsRepository = {
    findActiveById: mock.fn((): Promise<Listing | undefined> => Promise.resolve(undefined)),
    findActive: mock.fn(),
    create: mock.fn(),
    markRemoved: mock.fn(() => Promise.resolve()),
  };
  const categoriesService = {
    findActive: mock.fn(() => Promise.resolve(CATEGORY)),
    findAll: mock.fn(() => Promise.resolve([CATEGORY])),
  };
  const eventsService = { find: mock.fn((): Promise<Pick<Event, 'status'> | undefined> => Promise.resolve(undefined)) };
  const profilesService = { getSummaries: mock.fn(() => Promise.resolve(new Map())) };

  const service = new ListingsService(
    listingsRepository as unknown as ListingsRepository,
    categoriesService as unknown as CategoriesService,
    eventsService as unknown as EventsService,
    profilesService as unknown as ProfilesService,
  );
  return { service, listingsRepository, eventsService };
}

void describe('ListingsService', () => {
  void test('rejects a listing about a cancelled event and stores nothing', async () => {
    const { service, listingsRepository, eventsService } = makeService();
    eventsService.find.mock.mockImplementation(() => Promise.resolve({ status: 'cancelled' }));

    await assert.rejects(
      service.create(AUTHOR, newListing),
      (error) => error instanceof DomainError && error.code === 'EVENT_CANCELLED',
    );
    assert.equal(listingsRepository.create.mock.callCount(), 0);
  });

  void test('answers NOT_FOUND to someone who is not the author, and the listing stays', async () => {
    const { service, listingsRepository } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() => Promise.resolve(authorsListing));

    await assert.rejects(
      service.remove(SOMEONE_ELSE, authorsListing.id),
      (error) => error instanceof DomainError && error.code === 'NOT_FOUND',
    );
    assert.equal(listingsRepository.markRemoved.mock.callCount(), 0);
  });
});
