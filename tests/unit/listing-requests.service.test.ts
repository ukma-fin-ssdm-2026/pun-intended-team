// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { ListingRequestsService } from '../../dist/core/listings/services/listing-requests.service.js';
import type { Page, PageRequest } from '../../dist/core/common/page.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { TransactionRunner } from '../../dist/core/common/transaction-runner.js';
import type { ListingRequestsRepository } from '../../dist/core/listings/repositories/listing-requests.repository.js';
import type { ListingsRepository } from '../../dist/core/listings/repositories/listings.repository.js';
import type { Listing } from '../../dist/core/listings/types/listing.js';
import type { ListingRequest } from '../../dist/core/listings/types/listing-request.js';
import type { ProfilesService } from '../../dist/core/profiles/services/profiles.service.js';
import type { Contacts, PublicProfile } from '../../dist/core/profiles/types/profile.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { CATEGORY_ID } from './fixtures/catalog.ts';

// ACCOUNT_ID posts the listing, OTHER_ACCOUNT_ID asks to join it.
const AUTHOR_ID = ACCOUNT_ID;
const REQUESTER_ID = OTHER_ACCOUNT_ID;
const STRANGER_ID = 'a0000000-0000-4000-8000-000000000099';
const LISTING_ID = 'd0000000-0000-4000-8000-000000000001';
const REQUEST_ID = 'e0000000-0000-4000-8000-000000000001';
const PAGE: PageRequest = { limit: 20, offset: 0 };
const CONTACTS: Contacts = { phone: null, linkedAccounts: [] };

function aListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: LISTING_ID,
    authorId: AUTHOR_ID,
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

function aRequest(overrides: Partial<ListingRequest> = {}): ListingRequest {
  return {
    id: REQUEST_ID,
    listingId: LISTING_ID,
    requesterId: REQUESTER_ID,
    status: 'pending',
    createdAt: '2026-10-15T12:00:00.000Z',
    decidedAt: null,
    ...overrides,
  };
}

function aProfile(accountId: string, displayName: string): PublicProfile {
  return {
    accountId,
    username: displayName.toLowerCase(),
    displayName,
    description: '',
    occupation: '',
    age: 25,
    interests: [],
    photo: null,
    cover: null,
  };
}

/** Every dependency of ListingRequestsService as a mock; a test changes only what it needs. */
function makeService({
  listing = aListing(),
  request = aRequest(),
}: { listing?: Listing; request?: ListingRequest } = {}) {
  const requestsRepository = {
    create: mock.fn<(listingId: string, requesterId: string, tx?: Transaction) => Promise<ListingRequest>>(
      (listingId, requesterId) => Promise.resolve(aRequest({ listingId, requesterId })),
    ),
    findById: mock.fn((): Promise<ListingRequest | undefined> => Promise.resolve(request)),
    findByListingAndRequester: mock.fn((): Promise<ListingRequest | undefined> => Promise.resolve(undefined)),
    findOnListingsOf: mock.fn((_authorId: string, page: PageRequest): Promise<Page<ListingRequest>> =>
      Promise.resolve({ items: [request], page: { ...page, hasMore: false } }),
    ),
    decide: mock.fn<
      (
        id: string,
        status: 'accepted' | 'declined',
        decidedAt: Date,
        tx?: Transaction,
      ) => Promise<ListingRequest | undefined>
    >((_id, status, decidedAt) => Promise.resolve(aRequest({ status, decidedAt: decidedAt.toISOString() }))),
  };
  const listingsRepository = {
    findActiveById: mock.fn((): Promise<Listing | undefined> =>
      Promise.resolve(listing.status === 'active' ? listing : undefined),
    ),
    findByIds: mock.fn((): Promise<Listing[]> => Promise.resolve([listing])),
  };
  const profilesService = {
    isComplete: mock.fn(() => Promise.resolve(true)),
    getPublicProfiles: mock.fn(() =>
      Promise.resolve(
        new Map([
          [AUTHOR_ID, aProfile(AUTHOR_ID, 'Olena')],
          [REQUESTER_ID, aProfile(REQUESTER_ID, 'Taras')],
        ]),
      ),
    ),
    revealContacts: mock.fn<(viewerId: string, accountId: string) => Promise<Contacts>>(() =>
      Promise.resolve(CONTACTS),
    ),
  };
  const tx = {} as Transaction;
  const transactions = { run: mock.fn(<T>(work: (tx: Transaction) => Promise<T>) => work(tx)) };

  const service = new ListingRequestsService(
    requestsRepository as unknown as ListingRequestsRepository,
    listingsRepository as unknown as ListingsRepository,
    profilesService as unknown as ProfilesService,
    transactions as unknown as TransactionRunner,
  );
  return { service, requestsRepository, listingsRepository, profilesService, transactions, tx };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('ListingRequestsService.create', () => {
  test("stores a pending request on someone else's active listing, in a transaction", async () => {
    const { service, requestsRepository, tx } = makeService();

    const view = await service.create(REQUESTER_ID, LISTING_ID);

    assert.deepEqual(requestsRepository.create.mock.calls[0]?.arguments, [LISTING_ID, REQUESTER_ID, tx]);
    assert.equal(view.status, 'pending');
    assert.equal(view.role, 'requester');
    assert.equal(view.requester.displayName, 'Taras');
    assert.equal(view.author.displayName, 'Olena');
  });

  test('never shows the account ids of the two', async () => {
    const { service } = makeService();

    const view = await service.create(REQUESTER_ID, LISTING_ID);

    assert.equal('accountId' in view.requester, false);
    assert.equal('accountId' in view.author, false);
  });

  test('reports a listing that is not active as missing', async () => {
    const { service, requestsRepository } = makeService({ listing: aListing({ status: 'removed' }) });

    await assert.rejects(service.create(REQUESTER_ID, LISTING_ID), isDomainError('NOT_FOUND'));
    assert.equal(requestsRepository.create.mock.callCount(), 0);
  });

  test("rejects a request on the caller's own listing", async () => {
    const { service, requestsRepository } = makeService();

    await assert.rejects(service.create(AUTHOR_ID, LISTING_ID), isDomainError('CANNOT_REQUEST_OWN_LISTING'));
    assert.equal(requestsRepository.create.mock.callCount(), 0);
  });

  test('asks for a complete profile first', async () => {
    const { service, requestsRepository, profilesService } = makeService();
    profilesService.isComplete.mock.mockImplementation(() => Promise.resolve(false));

    await assert.rejects(service.create(REQUESTER_ID, LISTING_ID), isDomainError('PROFILE_INCOMPLETE'));
    assert.equal(requestsRepository.create.mock.callCount(), 0);
  });

  test('rejects a second request on the same listing', async () => {
    const { service, requestsRepository } = makeService();
    requestsRepository.findByListingAndRequester.mock.mockImplementation(() => Promise.resolve(aRequest()));

    await assert.rejects(service.create(REQUESTER_ID, LISTING_ID), isDomainError('ALREADY_REQUESTED'));
    assert.equal(requestsRepository.create.mock.callCount(), 0);
  });
});

describe('ListingRequestsService.listIncoming', () => {
  test("gives the requests on the author's listings with the requester's public profile", async () => {
    const { service, requestsRepository } = makeService();

    const result = await service.listIncoming(AUTHOR_ID, PAGE);

    assert.deepEqual(requestsRepository.findOnListingsOf.mock.calls[0]?.arguments, [AUTHOR_ID, PAGE]);
    assert.equal(result.items[0]?.role, 'author');
    assert.equal(result.items[0]?.requester.displayName, 'Taras');
    assert.deepEqual(result.items[0]?.listing, {
      id: LISTING_ID,
      title: aListing().title,
      date: aListing().date,
      place: null,
      eventId: null,
    });
  });

  test('leaves out a request whose requester has no profile', async () => {
    const { service, profilesService } = makeService();
    profilesService.getPublicProfiles.mock.mockImplementation(() =>
      Promise.resolve(new Map([[AUTHOR_ID, aProfile(AUTHOR_ID, 'Olena')]])),
    );

    const result = await service.listIncoming(AUTHOR_ID, PAGE);

    assert.deepEqual(result.items, []);
  });
});

describe('ListingRequestsService.getOwn', () => {
  for (const [who, userId, role] of [
    ['author', AUTHOR_ID, 'author'],
    ['requester', REQUESTER_ID, 'requester'],
  ] as const) {
    test(`gives the request to its ${who}`, async () => {
      const { service } = makeService();

      const view = await service.getOwn(userId, REQUEST_ID);

      assert.equal(view.role, role);
    });
  }

  test('reports the request as missing to anyone else', async () => {
    const { service } = makeService();

    await assert.rejects(service.getOwn(STRANGER_ID, REQUEST_ID), isDomainError('NOT_FOUND'));
  });

  test('reports a pending request on a removed listing as missing', async () => {
    const { service } = makeService({ listing: aListing({ status: 'removed' }) });

    await assert.rejects(service.getOwn(AUTHOR_ID, REQUEST_ID), isDomainError('NOT_FOUND'));
  });

  test('still gives an accepted request on a removed listing', async () => {
    const { service } = makeService({
      listing: aListing({ status: 'removed' }),
      request: aRequest({ status: 'accepted', decidedAt: '2026-10-15T13:00:00.000Z' }),
    });

    const view = await service.getOwn(REQUESTER_ID, REQUEST_ID);

    assert.equal(view.status, 'accepted');
  });
});

for (const [method, status] of [
  ['accept', 'accepted'],
  ['decline', 'declined'],
] as const) {
  describe(`ListingRequestsService.${method}`, () => {
    const answer = (service: ListingRequestsService, userId: string) =>
      method === 'accept' ? service.accept(userId, REQUEST_ID) : service.decline(userId, REQUEST_ID);

    test(`marks a pending request ${status}, in a transaction`, async () => {
      const { service, requestsRepository, tx } = makeService();

      const view = await answer(service, AUTHOR_ID);

      const [id, decided, , txArg] = requestsRepository.decide.mock.calls[0]?.arguments ?? [];
      assert.deepEqual([id, decided, txArg], [REQUEST_ID, status, tx]);
      assert.equal(view.status, status);
    });

    test('lets only the author answer', async () => {
      const { service, requestsRepository } = makeService();

      await assert.rejects(answer(service, REQUESTER_ID), isDomainError('NOT_FOUND'));
      assert.equal(requestsRepository.decide.mock.callCount(), 0);
    });

    test('rejects a request that has already been answered', async () => {
      const { service, requestsRepository } = makeService({
        request: aRequest({ status: 'declined', decidedAt: '2026-10-15T13:00:00.000Z' }),
      });

      await assert.rejects(answer(service, AUTHOR_ID), isDomainError('CONFLICT'));
      assert.equal(requestsRepository.decide.mock.callCount(), 0);
    });

    test('rejects a request another answer got to first', async () => {
      const { service, requestsRepository } = makeService();
      requestsRepository.decide.mock.mockImplementation(() => Promise.resolve(undefined));

      await assert.rejects(answer(service, AUTHOR_ID), isDomainError('CONFLICT'));
    });

    test('reports a pending request on a removed listing as missing', async () => {
      const { service, requestsRepository } = makeService({ listing: aListing({ status: 'removed' }) });

      await assert.rejects(answer(service, AUTHOR_ID), isDomainError('NOT_FOUND'));
      assert.equal(requestsRepository.decide.mock.callCount(), 0);
    });
  });
}

// FR-019, SEC-001, SAFE-002
describe('ListingRequestsService.getContacts', () => {
  const accepted = aRequest({ status: 'accepted', decidedAt: '2026-10-15T13:00:00.000Z' });

  for (const [who, userId, otherId] of [
    ['author', AUTHOR_ID, REQUESTER_ID],
    ['requester', REQUESTER_ID, AUTHOR_ID],
  ] as const) {
    test(`gives the ${who} the other side's contacts once accepted, through the safety notice check`, async () => {
      const { service, profilesService } = makeService({ request: accepted });

      const contacts = await service.getContacts(userId, REQUEST_ID);

      assert.deepEqual(profilesService.revealContacts.mock.calls[0]?.arguments, [userId, otherId]);
      assert.deepEqual(contacts, CONTACTS);
    });
  }

  for (const status of ['pending', 'declined'] as const) {
    test(`reports a ${status} request as missing`, async () => {
      const { service, profilesService } = makeService({ request: aRequest({ status }) });

      await assert.rejects(service.getContacts(AUTHOR_ID, REQUEST_ID), isDomainError('NOT_FOUND'));
      assert.equal(profilesService.revealContacts.mock.callCount(), 0);
    });
  }

  test('reports an accepted request as missing to anyone else', async () => {
    const { service, profilesService } = makeService({ request: accepted });

    await assert.rejects(service.getContacts(STRANGER_ID, REQUEST_ID), isDomainError('NOT_FOUND'));
    assert.equal(profilesService.revealContacts.mock.callCount(), 0);
  });
});
