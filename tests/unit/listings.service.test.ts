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
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { ImagesService, PreparedImage } from '../../dist/core/images/services/images.service.js';
import type { ImageRef } from '../../dist/core/images/types/image.js';
import type { ListingRequestsRepository } from '../../dist/core/listings/repositories/listing-requests.repository.js';
import type { ListingsRepository } from '../../dist/core/listings/repositories/listings.repository.js';
import type { Listing, ListingRecord, NewListing } from '../../dist/core/listings/types/listing.js';
import type { ListingRequest } from '../../dist/core/listings/types/listing-request.js';
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
    photoId: null,
    place: null,
    ...overrides,
  };
}

const OLD_PHOTO_ID = 'a0000000-0000-4000-8000-000000000001';
const PHOTO: ImageRef = { id: 'a0000000-0000-4000-8000-000000000002', width: 1200, height: 600, crop: null };
const UPLOAD = {
  content: new Uint8Array([1, 2, 3]),
  contentType: 'image/png',
  crop: { left: 0, top: 0, width: 1, height: 0.5 },
};

/** The profile of ACCOUNT_ID as listing readers see it. */
function anAuthor(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return { accountId: ACCOUNT_ID, username: 'olena', displayName: 'Olena', photoId: null, ...overrides };
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
    findByIds: mock.fn((): Promise<Listing[]> => Promise.resolve([aListing({ status: 'removed' })])),
    setPhoto: mock.fn((_id: string, photoId: string | null) => Promise.resolve(aListing({ photoId }))),
  };
  const requestsRepository = {
    findOwn: mock.fn<(requesterId: string, listingIds: string[]) => Promise<Map<string, ListingRequest>>>(() =>
      Promise.resolve(new Map()),
    ),
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

  const prepared = {
    encoded: { content: new Uint8Array(), contentType: 'image/webp', width: 1200, height: 600 },
    crop: null,
    isPublic: false,
  };
  const imagesService = {
    prepare: mock.fn((): Promise<PreparedImage> => Promise.resolve(prepared)),
    save: mock.fn((): Promise<ImageRef> => Promise.resolve(PHOTO)),
    remove: mock.fn(() => Promise.resolve()),
    getRefs: mock.fn((ids: (string | null)[]) =>
      Promise.resolve(new Map(ids.includes(PHOTO.id) ? [[PHOTO.id, PHOTO]] : [])),
    ),
  };
  const tx = {} as Transaction;
  const transactions = { run: mock.fn(<T>(work: (tx: Transaction) => Promise<T>) => work(tx)) };

  const service = new ListingsService(
    listingsRepository as unknown as ListingsRepository,
    requestsRepository as unknown as ListingRequestsRepository,
    categoriesService as unknown as CategoriesService,
    eventsService as unknown as EventsService,
    profilesService as unknown as ProfilesService,
    imagesService as unknown as ImagesService,
    transactions as unknown as TransactionRunner,
  );
  return {
    service,
    listingsRepository,
    requestsRepository,
    categoriesService,
    eventsService,
    profilesService,
    imagesService,
    tx,
  };
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

    const result = await service.list(OTHER_ACCOUNT_ID, PAGE);

    assert.deepEqual(listingsRepository.findActive.mock.calls[0]?.arguments, [TODAY, PAGE]);
    assert.deepEqual(result.items[0]?.author, { ...anAuthor(), photo: null });
    assert.equal(result.items[0]?.category.name, aCategory().name);
  });

  test("adds the author's photo", async () => {
    const { service, profilesService } = makeService();
    profilesService.getSummaries.mock.mockImplementation(() =>
      Promise.resolve(new Map([[ACCOUNT_ID, anAuthor({ photoId: PHOTO.id })]])),
    );

    const result = await service.list(OTHER_ACCOUNT_ID, PAGE);

    assert.deepEqual(result.items[0]?.author.photo, PHOTO);
  });

  test('leaves out a listing whose author has no profile', async () => {
    const { service, profilesService } = makeService();
    profilesService.getSummaries.mock.mockImplementation(() => Promise.resolve(new Map()));

    const result = await service.list(OTHER_ACCOUNT_ID, PAGE);

    assert.deepEqual(result.items, []);
  });
});

// One query for the viewer's requests on the whole page, none on their own listings.
describe('ListingsService myRequest', () => {
  test("adds the viewer's own request to each listing of the page", async () => {
    const { service, requestsRepository } = makeService();
    requestsRepository.findOwn.mock.mockImplementation(() =>
      Promise.resolve(
        new Map([
          [
            LISTING_ID,
            {
              id: 'e0000000-0000-4000-8000-000000000001',
              listingId: LISTING_ID,
              requesterId: OTHER_ACCOUNT_ID,
              status: 'pending' as const,
              createdAt: '2026-10-14T09:00:00.000Z',
              decidedAt: null,
            },
          ],
        ]),
      ),
    );

    const result = await service.list(OTHER_ACCOUNT_ID, PAGE);

    assert.deepEqual(requestsRepository.findOwn.mock.calls[0]?.arguments, [OTHER_ACCOUNT_ID, [LISTING_ID]]);
    assert.equal(requestsRepository.findOwn.mock.callCount(), 1);
    assert.deepEqual(result.items[0]?.myRequest, { id: 'e0000000-0000-4000-8000-000000000001', status: 'pending' });
  });

  test('gives null without a request', async () => {
    const { service } = makeService();

    const result = await service.list(OTHER_ACCOUNT_ID, PAGE);

    assert.equal(result.items[0]?.myRequest, null);
  });

  test("does not look for requests on the viewer's own listings", async () => {
    const { service, requestsRepository } = makeService();

    await service.list(ACCOUNT_ID, PAGE);

    assert.deepEqual(requestsRepository.findOwn.mock.calls[0]?.arguments, [ACCOUNT_ID, []]);
  });
});

describe('ListingsService.getById', () => {
  test('answers NOT_FOUND to an unknown listing', async () => {
    const { service } = makeService();

    await assert.rejects(service.getById(OTHER_ACCOUNT_ID, LISTING_ID), isDomainError('NOT_FOUND'));
  });

  test('answers NOT_FOUND when the author has no profile', async () => {
    const { service, listingsRepository, profilesService } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() => Promise.resolve(aListing()));
    profilesService.getSummaries.mock.mockImplementation(() => Promise.resolve(new Map()));

    await assert.rejects(service.getById(OTHER_ACCOUNT_ID, LISTING_ID), isDomainError('NOT_FOUND'));
  });
});

describe('ListingsService.create', () => {
  useFixedClock();

  test('stores an active listing by the author and returns it with details', async () => {
    const { service, listingsRepository } = makeService();
    const input = aNewListing();

    const result = await service.create(ACCOUNT_ID, input);

    assert.deepEqual(listingsRepository.create.mock.calls[0]?.arguments, [
      { ...input, authorId: ACCOUNT_ID, status: 'active', photoId: null, place: null },
    ]);
    assert.deepEqual(result.author, { ...anAuthor(), photo: null });
  });

  test('stores the place picked on the map', async () => {
    const { service, listingsRepository } = makeService();
    const place = {
      name: 'Мистецький Арсенал',
      address: 'вулиця Лаврська, 10',
      location: { lat: 50.4357, lng: 30.5555 },
    };

    const result = await service.create(ACCOUNT_ID, aNewListing({ place }));

    assert.deepEqual(listingsRepository.create.mock.calls[0]?.arguments[0]?.place, place);
    assert.deepEqual(result.place, place);
  });

  test('rejects a place outside Kyiv with PLACE_OUTSIDE_CITY', async () => {
    const { service, listingsRepository } = makeService();
    const place = { name: 'Lviv Opera', address: '', location: { lat: 49.8441, lng: 24.0262 } };

    await assert.rejects(
      service.create(ACCOUNT_ID, aNewListing({ place })),
      (error: unknown) =>
        error instanceof DomainError && error.code === 'PLACE_OUTSIDE_CITY' && error.field === 'place.location',
    );
    assert.equal(listingsRepository.create.mock.callCount(), 0);
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

  test('fails with a plain error when the author has no profile, since that is a data bug', async () => {
    const { service, profilesService } = makeService();
    profilesService.getSummaries.mock.mockImplementation(() => Promise.resolve(new Map()));

    await assert.rejects(
      service.create(ACCOUNT_ID, aNewListing()),
      (error) => error instanceof Error && !(error instanceof DomainError) && /profile/.test(error.message),
    );
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

// FR-028
describe('ListingsService.findByIds', () => {
  test('gives the listings in any status, removed ones included', async () => {
    const { service } = makeService();

    assert.deepEqual(await service.findByIds([LISTING_ID]), [aListing({ status: 'removed' })]);
  });

  test('asks the repository nothing for no ids', async () => {
    const { service, listingsRepository } = makeService();

    assert.deepEqual(await service.findByIds([]), []);
    assert.equal(listingsRepository.findByIds.mock.callCount(), 0);
  });
});

// FR-028
describe('ListingsService.removeReported', () => {
  test('marks someone else’s listing as removed, for an administrator', async () => {
    const { service, listingsRepository } = makeService();

    await service.removeReported(LISTING_ID);

    assert.deepEqual(listingsRepository.markRemoved.mock.calls[0]?.arguments, [LISTING_ID]);
  });
});

describe('ListingsService.setPhoto', () => {
  test('crops the upload to 2:1, points the listing at it and deletes the old photo in one transaction', async () => {
    const { service, listingsRepository, imagesService, tx } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() =>
      Promise.resolve(aListing({ photoId: OLD_PHOTO_ID })),
    );

    const listing = await service.setPhoto(ACCOUNT_ID, LISTING_ID, UPLOAD);

    assert.deepEqual(imagesService.prepare.mock.calls[0]?.arguments, ['listingPhoto', UPLOAD]);
    assert.deepEqual(listingsRepository.setPhoto.mock.calls[0]?.arguments, [LISTING_ID, PHOTO.id, tx]);
    assert.deepEqual(imagesService.remove.mock.calls[0]?.arguments, [[OLD_PHOTO_ID], tx]);
    assert.deepEqual(listing.photo, PHOTO);
  });

  test('answers NOT_FOUND to someone who is not the author, without reading the picture', async () => {
    const { service, listingsRepository, imagesService } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() => Promise.resolve(aListing()));

    await assert.rejects(service.setPhoto(OTHER_ACCOUNT_ID, LISTING_ID, UPLOAD), isDomainError('NOT_FOUND'));
    assert.equal(imagesService.prepare.mock.callCount(), 0);
  });
});

describe('ListingsService.removePhoto', () => {
  test('clears the photo and deletes its picture', async () => {
    const { service, listingsRepository, imagesService, tx } = makeService();
    listingsRepository.findActiveById.mock.mockImplementation(() =>
      Promise.resolve(aListing({ photoId: OLD_PHOTO_ID })),
    );

    const listing = await service.removePhoto(ACCOUNT_ID, LISTING_ID);

    assert.deepEqual(listingsRepository.setPhoto.mock.calls[0]?.arguments, [LISTING_ID, null, tx]);
    assert.deepEqual(imagesService.remove.mock.calls[0]?.arguments, [[OLD_PHOTO_ID], tx]);
    assert.equal(listing.photo, null);
  });
});
