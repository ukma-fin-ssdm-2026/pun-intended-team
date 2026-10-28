// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { ListingsService } from '../../dist/core/listings/services/listings.service.js';
import type { CategoriesService } from '../../dist/core/catalog/services/categories.service.js';
import type { EventsService } from '../../dist/core/catalog/services/events.service.js';
import type { Category } from '../../dist/core/catalog/types/category.js';
import type { Event } from '../../dist/core/catalog/types/event.js';
import type { Page, PageRequest } from '../../dist/core/common/page.js';
import type { ListingsRepository } from '../../dist/core/listings/repositories/listings.repository.js';
import type { Listing, ListingRecord, NewListing } from '../../dist/core/listings/types/listing.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { ProfileSummary } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { aCategory, anEvent, CATEGORY_ID, EVENT_ID } from './fixtures/catalog.ts';
import { TODAY, useFixedClock } from './fixtures/clock.ts';

const LISTING_ID = 'd0000000-0000-4000-8000-000000000001';
const PAGE: PageRequest = { limit: 20, offset: 0 };

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

/** The profile of ACCOUNT_ID as listing readers see it. */
function anAuthor(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return { accountId: ACCOUNT_ID, username: 'olena', displayName: 'Olena', ...overrides };
}

/** Every dependency of ListingsService as a mock; a test changes only what it needs. */
function makeService() {
  const listingsRepository = {
    findActiveById: mock.fn((): Promise<Listing | undefined> => Promise.resolve(undefined)),
    findActive: mock.fn((_fromDate: string, page: PageRequest): Promise<Page<Listing>> =>
      Promise.resolve({ items: [aListing()], page: { ...page, hasMore: false } }),
    ),
    create: mock.fn((record: ListingRecord): Promise<Listing> => Promise.resolve({ id: LISTING_ID, ...record })),
    markRemoved: mock.fn(() => Promise.resolve()),
  };
  const categoriesService = {
    findActive: mock.fn((): Promise<Category | undefined> => Promise.resolve(aCategory())),
    findAll: mock.fn(() => Promise.resolve([aCategory()])),
  };
  const eventsService = { find: mock.fn((): Promise<Event | undefined> => Promise.resolve(anEvent())) };
  const profilesService = {
    getSummaries: mock.fn((): Promise<Map<string, ProfileSummary>> =>
      Promise.resolve(new Map([[ACCOUNT_ID, anAuthor()]])),
    ),
  };

  const service = new ListingsService(
    listingsRepository as unknown as ListingsRepository,
    categoriesService as unknown as CategoriesService,
    eventsService as unknown as EventsService,
    profilesService as unknown as ProfilesService,
  );
  return { service, listingsRepository, categoriesService, eventsService, profilesService };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('ListingsService.list', () => {
  useFixedClock();

  test('asks for active listings from today in Kyiv and adds their author and category', async () => {
    // 00:30 on TODAY in Kyiv, still the day before in UTC.
    mock.timers.setTime(Date.parse('2026-10-14T21:30:00Z'));
    const { service, listingsRepository } = makeService();

    const result = await service.list(PAGE);

    assert.deepEqual(listingsRepository.findActive.mock.calls[0]?.arguments, [TODAY, PAGE]);
    assert.deepEqual(result.items[0]?.author, anAuthor());
    assert.equal(result.items[0]?.category.name, aCategory().name);
  });
});

describe('ListingsService.getById', () => {
  test('answers NOT_FOUND to an unknown listing', async () => {
    const { service } = makeService();

    await assert.rejects(service.getById(LISTING_ID), isDomainError('NOT_FOUND'));
  });

  test('fails with a plain error when the author has no profile, since that is a data bug', async () => {
    const { service, listingsRepository, profilesService } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() => Promise.resolve(aListing()));
    profilesService.getSummaries.mock.mockImplementation(() => Promise.resolve(new Map()));

    await assert.rejects(
      service.getById(LISTING_ID),
      (error) => error instanceof Error && !(error instanceof DomainError) && /profile/.test(error.message),
    );
  });
});

describe('ListingsService.create', () => {
  useFixedClock();

  test('stores an active listing by the author and returns it with details', async () => {
    const { service, listingsRepository } = makeService();
    const input = aNewListing();

    const result = await service.create(ACCOUNT_ID, input);

    assert.deepEqual(listingsRepository.create.mock.calls[0]?.arguments, [
      { ...input, authorId: ACCOUNT_ID, status: 'active' },
    ]);
    assert.deepEqual(result.author, anAuthor());
  });

  test('stores a listing without an event with eventId null and does not look one up', async () => {
    const { service, listingsRepository, eventsService } = makeService();
    const { eventId: _, ...withoutEvent } = aNewListing();

    await service.create(ACCOUNT_ID, withoutEvent);

    assert.equal(eventsService.find.mock.callCount(), 0);
    assert.equal(listingsRepository.create.mock.calls[0]?.arguments[0]?.eventId, null);
  });

  test('accepts a listing for today', async () => {
    const { service, listingsRepository } = makeService();

    await service.create(ACCOUNT_ID, aNewListing({ date: TODAY }));

    assert.equal(listingsRepository.create.mock.callCount(), 1);
  });

  test('rejects a listing for yesterday and stores nothing', async () => {
    const { service, listingsRepository } = makeService();

    const creating = service.create(ACCOUNT_ID, aNewListing({ date: '2026-10-14' }));

    await assert.rejects(creating, isDomainError('LISTING_DATE_IN_PAST'));
    assert.equal(listingsRepository.create.mock.callCount(), 0);
  });

  test('counts the date in Kyiv: at 00:30 in Kyiv, the UTC date is already in the past', async () => {
    mock.timers.setTime(Date.parse('2026-10-14T21:30:00Z'));
    const { service } = makeService();

    const creating = service.create(ACCOUNT_ID, aNewListing({ date: '2026-10-14' }));

    await assert.rejects(creating, isDomainError('LISTING_DATE_IN_PAST'));
  });

  test('rejects a category that is not active', async () => {
    const { service, listingsRepository, categoriesService } = makeService();
    categoriesService.findActive.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.create(ACCOUNT_ID, aNewListing()), isDomainError('REFERENCE_NOT_FOUND'));
    assert.equal(listingsRepository.create.mock.callCount(), 0);
  });

  test('rejects an unknown event', async () => {
    const { service, listingsRepository, eventsService } = makeService();
    eventsService.find.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(service.create(ACCOUNT_ID, aNewListing()), isDomainError('REFERENCE_NOT_FOUND'));
    assert.equal(listingsRepository.create.mock.callCount(), 0);
  });

  test('rejects a listing about a cancelled event and stores nothing', async () => {
    const { service, listingsRepository, eventsService } = makeService();
    eventsService.find.mock.mockImplementation(() => Promise.resolve(anEvent({ status: 'cancelled' })));

    const creating = service.create(ACCOUNT_ID, aNewListing());

    await assert.rejects(creating, isDomainError('EVENT_CANCELLED'));
    assert.equal(listingsRepository.create.mock.callCount(), 0);
  });
});

describe('ListingsService.remove', () => {
  test('marks the author’s own listing as removed', async () => {
    const { service, listingsRepository } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() => Promise.resolve(aListing()));

    await service.remove(ACCOUNT_ID, LISTING_ID);

    assert.deepEqual(listingsRepository.markRemoved.mock.calls[0]?.arguments, [LISTING_ID]);
  });

  test('answers NOT_FOUND to someone who is not the author, and the listing stays', async () => {
    const { service, listingsRepository } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() => Promise.resolve(aListing()));

    const removing = service.remove(OTHER_ACCOUNT_ID, LISTING_ID);

    await assert.rejects(removing, isDomainError('NOT_FOUND'));
    assert.equal(listingsRepository.markRemoved.mock.callCount(), 0);
  });

  test('answers NOT_FOUND to an unknown listing', async () => {
    const { service, listingsRepository } = makeService();

    await assert.rejects(service.remove(ACCOUNT_ID, LISTING_ID), isDomainError('NOT_FOUND'));
    assert.equal(listingsRepository.markRemoved.mock.callCount(), 0);
  });
});
