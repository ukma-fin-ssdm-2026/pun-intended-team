// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { Listing as ListingRow } from '../../dist/infra/prisma/generated/client.js';
import { PrismaListingsRepository } from '../../dist/infra/prisma/prisma-listings.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { CATEGORY_ID } from './fixtures/catalog.ts';

const CREATED = new Date('2026-11-01T09:00:00Z');

/** A listing row as Prisma returns it: the date is midnight UTC of the day. */
function aRow(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: 'l0000000-0000-4000-8000-000000000001',
    authorId: ACCOUNT_ID,
    categoryId: CATEGORY_ID,
    eventId: null,
    title: 'Looking for company',
    description: 'Evening, coffee after.',
    date: new Date('2026-11-14T00:00:00Z'),
    status: 'active',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

function makeRepository(rows: ListingRow[] = []) {
  // Each Prisma call takes one argument, which the tests read back from `mock.calls`.
  const query = () => mock.fn<(args: unknown) => Promise<unknown>>();
  const listing = { findMany: query(), findFirst: query(), create: query(), updateMany: query() };
  listing.findMany.mock.mockImplementation(() => Promise.resolve(rows));
  listing.findFirst.mock.mockImplementation(() => Promise.resolve(rows[0] ?? null));
  listing.create.mock.mockImplementation(() => Promise.resolve(rows[0]));
  return { repository: new PrismaListingsRepository({ listing } as unknown as PrismaService), listing };
}

describe('PrismaListingsRepository.findActive', () => {
  test('asks for active listings from the Kyiv date on, soonest first', async () => {
    const { repository, listing } = makeRepository();

    await repository.findActive('2026-11-10', { limit: 20, offset: 0 });

    const query = listing.findMany.mock.calls[0]?.arguments[0] as { where: unknown; orderBy: unknown };
    assert.deepEqual(query.where, { status: 'active', date: { gte: new Date('2026-11-10T00:00:00Z') } });
    assert.deepEqual(query.orderBy, [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]);
  });

  test('gives the date of a listing as a plain date and reports whether another page follows', async () => {
    const { repository } = makeRepository([aRow({ id: 'a' }), aRow({ id: 'b' })]);

    const { items, page } = await repository.findActive('2026-11-10', { limit: 1, offset: 0 });

    assert.deepEqual(
      items.map(({ id, date }) => [id, date]),
      [['a', '2026-11-14']],
    );
    assert.equal(page.hasMore, true);
  });
});

describe('PrismaListingsRepository.create', () => {
  test('stores the date as midnight UTC of the day', async () => {
    const { repository, listing } = makeRepository([aRow()]);
    const record = {
      authorId: ACCOUNT_ID,
      categoryId: CATEGORY_ID,
      eventId: null,
      title: 'Looking for company',
      description: 'Evening, coffee after.',
      date: '2026-11-14',
      status: 'active' as const,
    };

    await repository.create(record);

    const { data } = listing.create.mock.calls[0]?.arguments[0] as { data: { date: Date } };
    assert.deepEqual(data.date, new Date('2026-11-14T00:00:00Z'));
  });
});

describe('PrismaListingsRepository.markRemoved', () => {
  test('marks the listing as removed', async () => {
    const { repository, listing } = makeRepository();

    await repository.markRemoved('l0000000-0000-4000-8000-000000000001');

    assert.deepEqual(listing.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: 'l0000000-0000-4000-8000-000000000001' },
      data: { status: 'removed' },
    });
  });
});
