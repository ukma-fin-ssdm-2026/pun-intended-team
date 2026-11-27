// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { Prisma, type ListingRequest as ListingRequestRow } from '../../dist/infra/prisma/generated/client.js';
import { PrismaListingRequestsRepository } from '../../dist/infra/prisma/prisma-listing-requests.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';

const LISTING_ID = 'd0000000-0000-4000-8000-000000000001';
const REQUEST_ID = 'e0000000-0000-4000-8000-000000000001';
const CREATED = new Date('2026-11-01T09:00:00Z');
const DECIDED = new Date('2026-11-01T10:00:00Z');

function aRow(overrides: Partial<ListingRequestRow> = {}): ListingRequestRow {
  return {
    id: REQUEST_ID,
    listingId: LISTING_ID,
    requesterId: OTHER_ACCOUNT_ID,
    status: 'pending',
    createdAt: CREATED,
    decidedAt: null,
    ...overrides,
  };
}

function uniqueViolation(index: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { driverAdapterError: { cause: { constraint: { index } } } },
  });
}

function makeRepository(rows: ListingRequestRow[] = [aRow()]) {
  // Each Prisma call takes one argument, which the tests read back from `mock.calls`.
  const query = () => mock.fn<(args: unknown) => Promise<unknown>>();
  const listingRequest = {
    create: query(),
    findUnique: query(),
    findMany: query(),
    updateMany: query(),
  };
  listingRequest.create.mock.mockImplementation(() => Promise.resolve(rows[0]));
  listingRequest.findUnique.mock.mockImplementation(() => Promise.resolve(rows[0] ?? null));
  listingRequest.findMany.mock.mockImplementation(() => Promise.resolve(rows));
  listingRequest.updateMany.mock.mockImplementation(() => Promise.resolve({ count: 1 }));
  const repository = new PrismaListingRequestsRepository({ listingRequest } as unknown as PrismaService);
  return { repository, listingRequest };
}

describe('PrismaListingRequestsRepository.create', () => {
  test('gives the times as ISO strings', async () => {
    const { repository } = makeRepository();

    const request = await repository.create(LISTING_ID, OTHER_ACCOUNT_ID);

    assert.deepEqual(request, {
      id: REQUEST_ID,
      listingId: LISTING_ID,
      requesterId: OTHER_ACCOUNT_ID,
      status: 'pending',
      createdAt: CREATED.toISOString(),
      decidedAt: null,
    });
  });

  test('reports a second request on the same listing as ALREADY_REQUESTED', async () => {
    const { repository, listingRequest } = makeRepository();
    listingRequest.create.mock.mockImplementation(() =>
      Promise.reject(uniqueViolation('listing_requests_listing_id_requester_id_key')),
    );

    await assert.rejects(
      repository.create(LISTING_ID, OTHER_ACCOUNT_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'ALREADY_REQUESTED',
    );
  });
});

describe('PrismaListingRequestsRepository.findOwn', () => {
  test('asks nothing for no listings', async () => {
    const { repository, listingRequest } = makeRepository();

    const own = await repository.findOwn(OTHER_ACCOUNT_ID, []);

    assert.equal(own.size, 0);
    assert.equal(listingRequest.findMany.mock.callCount(), 0);
  });

  test('gives the requests by listing id', async () => {
    const { repository, listingRequest } = makeRepository();

    const own = await repository.findOwn(OTHER_ACCOUNT_ID, [LISTING_ID]);

    assert.deepEqual(listingRequest.findMany.mock.calls[0]?.arguments[0], {
      where: { requesterId: OTHER_ACCOUNT_ID, listingId: { in: [LISTING_ID] } },
    });
    assert.equal(own.get(LISTING_ID)?.id, REQUEST_ID);
  });
});

describe('PrismaListingRequestsRepository.findOnListingsOf', () => {
  test("asks for the author's requests, pending first and newest first, without pending ones on removed listings", async () => {
    const { repository, listingRequest } = makeRepository();

    await repository.findOnListingsOf(ACCOUNT_ID, { limit: 20, offset: 0 });

    const args = listingRequest.findMany.mock.calls[0]?.arguments[0] as { where: unknown; orderBy: unknown };
    assert.deepEqual(args.where, {
      listing: { authorId: ACCOUNT_ID },
      NOT: { status: 'pending', listing: { status: 'removed' } },
    });
    assert.deepEqual(args.orderBy, [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }]);
  });

  test('reports whether another page follows', async () => {
    const { repository } = makeRepository([aRow({ id: 'a' }), aRow({ id: 'b' })]);

    const { items, page } = await repository.findOnListingsOf(ACCOUNT_ID, { limit: 1, offset: 0 });

    assert.deepEqual(
      items.map(({ id }) => id),
      ['a'],
    );
    assert.equal(page.hasMore, true);
  });
});

describe('PrismaListingRequestsRepository.decide', () => {
  test('changes only a pending request and gives it back', async () => {
    const { repository, listingRequest } = makeRepository([aRow({ status: 'accepted', decidedAt: DECIDED })]);

    const request = await repository.decide(REQUEST_ID, 'accepted', DECIDED);

    assert.deepEqual(listingRequest.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: REQUEST_ID, status: 'pending' },
      data: { status: 'accepted', decidedAt: DECIDED },
    });
    assert.equal(request?.decidedAt, DECIDED.toISOString());
  });

  test('gives undefined when the request is no longer pending', async () => {
    const { repository, listingRequest } = makeRepository();
    listingRequest.updateMany.mock.mockImplementation(() => Promise.resolve({ count: 0 }));

    assert.equal(await repository.decide(REQUEST_ID, 'declined', DECIDED), undefined);
    assert.equal(listingRequest.findUnique.mock.callCount(), 0);
  });
});
