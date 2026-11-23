// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaVenuesRepository } from '../../dist/infra/prisma/prisma-venues.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { aVenue } from './fixtures/catalog.ts';
import { aVenueRow } from './fixtures/catalog-rows.ts';

const ORGANIZATION = { accountId: ACCOUNT_ID, name: 'Podil Film Club' };

function makeRepository() {
  const venue = {
    findMany: mock.fn<(args: unknown) => Promise<unknown[]>>(() =>
      Promise.resolve([{ ...aVenueRow(), organization: ORGANIZATION }]),
    ),
  };
  return { repository: new PrismaVenuesRepository({ venue } as unknown as PrismaService), venue };
}

describe('PrismaVenuesRepository.search', () => {
  test('matches part of the name or the address in any case, with the source and the organization', async () => {
    const { repository, venue } = makeRepository();

    await repository.search(
      { search: 'park', source: 'organization', organizationId: ACCOUNT_ID },
      {
        limit: 20,
        offset: 0,
      },
    );

    const { where } = venue.findMany.mock.calls[0]?.arguments[0] as { where: unknown };
    const text = { contains: 'park', mode: 'insensitive' };
    assert.deepEqual(where, {
      source: 'organization',
      organizationId: ACCOUNT_ID,
      OR: [{ name: text }, { address: text }],
    });
  });

  test('lists every venue without a filter, each with its organization', async () => {
    const { repository, venue } = makeRepository();

    const { items } = await repository.search({}, { limit: 20, offset: 0 });

    const { where } = venue.findMany.mock.calls[0]?.arguments[0] as { where: unknown };
    assert.deepEqual(where, { source: undefined, organizationId: undefined, OR: undefined });
    assert.deepEqual(items, [{ ...aVenue(), organization: ORGANIZATION }]);
  });
});
