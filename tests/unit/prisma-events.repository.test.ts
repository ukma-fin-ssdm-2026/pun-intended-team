// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaEventsRepository } from '../../dist/infra/prisma/prisma-events.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { EVENT_ID } from './fixtures/catalog.ts';
import { anEventRow } from './fixtures/catalog-rows.ts';

const FILTER = { from: '2026-11-10', to: '2026-11-12' };

function makeRepository(rows: ReturnType<typeof anEventRow>[] = []) {
  // Each Prisma call takes one argument, which the tests read back from `mock.calls`.
  const query = () => mock.fn<(args: unknown) => Promise<unknown>>();
  const event = { findMany: query(), findUnique: query(), update: query(), count: query() };
  event.findMany.mock.mockImplementation(() => Promise.resolve(rows));
  event.update.mock.mockImplementation(() => Promise.resolve(anEventRow()));
  event.count.mock.mockImplementation(() => Promise.resolve(2));
  return { repository: new PrismaEventsRepository({ event } as unknown as PrismaService), event };
}

describe('PrismaEventsRepository.findPublished', () => {
  // Kyiv is UTC+2 in November: its day ends at 21:59:59.999Z.
  test('asks for events that end after the day before the filter and start by the end of its last day', async () => {
    const { repository, event } = makeRepository();

    await repository.findPublished(FILTER, { limit: 20, offset: 0 });

    const { where } = event.findMany.mock.calls[0]?.arguments[0] as { where: unknown };
    assert.deepEqual(where, {
      status: 'published',
      categoryId: undefined,
      venueId: undefined,
      endsAt: { gt: new Date('2026-11-09T21:59:59.999Z') },
      startsAt: { lte: new Date('2026-11-12T21:59:59.999Z') },
    });
  });

  test('reads one row more than the page to know whether another page follows', async () => {
    const { repository, event } = makeRepository([
      anEventRow({ id: 'a' }),
      anEventRow({ id: 'b' }),
      anEventRow({ id: 'c' }),
    ]);

    const { items, page } = await repository.findPublished(FILTER, { limit: 2, offset: 4 });

    assert.deepEqual(
      items.map(({ id }) => id),
      ['a', 'b'],
    );
    assert.deepEqual(page, { limit: 2, offset: 4, hasMore: true });
    assert.equal((event.findMany.mock.calls[0]?.arguments[0] as { take: number }).take, 3);
  });

  test('reports no further page when the database returns no more than the page', async () => {
    const { repository } = makeRepository([anEventRow({ id: 'a' }), anEventRow({ id: 'b' })]);

    const { page } = await repository.findPublished(FILTER, { limit: 2, offset: 0 });

    assert.equal(page.hasMore, false);
  });
});

describe('PrismaEventsRepository.update', () => {
  test('leaves the times out of the update when they are not changed', async () => {
    const { repository, event } = makeRepository();

    await repository.update(EVENT_ID, { title: 'New title' });

    const { data } = event.update.mock.calls[0]?.arguments[0] as { data: Record<string, unknown> };
    assert.deepEqual(data, { title: 'New title', startsAt: undefined, endsAt: undefined });
  });
});

describe('PrismaEventsRepository.countPublishedEndingAfter', () => {
  test('counts the published events that end after the instant', async () => {
    const { repository, event } = makeRepository();
    const instant = new Date('2026-11-01T12:00:00Z');

    const count = await repository.countPublishedEndingAfter(instant);

    assert.equal(count, 2);
    assert.deepEqual(event.count.mock.calls[0]?.arguments[0], {
      where: { status: 'published', endsAt: { gt: instant } },
    });
  });
});

describe('PrismaEventsRepository.search', () => {
  const NOW = new Date('2026-11-21T10:00:00Z');
  const ORGANIZATION = { accountId: ACCOUNT_ID, name: 'Podil Film Club' };

  test('lists upcoming events in any status, soonest first, with the filters', async () => {
    const { repository, event } = makeRepository();

    await repository.search(
      { period: 'upcoming', search: 'film', source: 'organization', status: 'cancelled', organizationId: ACCOUNT_ID },
      NOW,
      { limit: 20, offset: 0 },
    );

    const { where, orderBy } = event.findMany.mock.calls[0]?.arguments[0] as { where: unknown; orderBy: unknown };
    assert.deepEqual(where, {
      source: 'organization',
      status: 'cancelled',
      organizationId: ACCOUNT_ID,
      venueId: undefined,
      categoryId: undefined,
      title: { contains: 'film', mode: 'insensitive' },
      endsAt: { gt: NOW },
    });
    assert.deepEqual(orderBy, [{ startsAt: 'asc' }, { id: 'asc' }]);
  });

  test('lists past events latest first', async () => {
    const { repository, event } = makeRepository();

    await repository.search({ period: 'past' }, NOW, { limit: 20, offset: 0 });

    const { where, orderBy } = event.findMany.mock.calls[0]?.arguments[0] as {
      where: { endsAt: unknown; title: unknown };
      orderBy: unknown;
    };
    assert.deepEqual(where.endsAt, { lte: NOW });
    assert.equal(where.title, undefined);
    assert.deepEqual(orderBy, [{ startsAt: 'desc' }, { id: 'asc' }]);
  });

  test('gives each event with its organization, and null for an imported one', async () => {
    const { repository } = makeRepository([
      { ...anEventRow({ id: 'a' }), organization: ORGANIZATION },
      { ...anEventRow({ id: 'b', organizationId: null, source: 'import' }), organization: null },
    ] as ReturnType<typeof anEventRow>[]);

    const { items } = await repository.search({ period: 'upcoming' }, NOW, { limit: 20, offset: 0 });

    assert.deepEqual(
      items.map(({ id, organization }) => ({ id, organization })),
      [
        { id: 'a', organization: ORGANIZATION },
        { id: 'b', organization: null },
      ],
    );
  });
});

describe('PrismaEventsRepository.findOverview', () => {
  test('is undefined for an unknown event', async () => {
    const { repository, event } = makeRepository();
    event.findUnique.mock.mockImplementation(() => Promise.resolve(null));

    assert.equal(await repository.findOverview(EVENT_ID), undefined);
  });
});
