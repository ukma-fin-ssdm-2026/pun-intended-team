// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaOrganizationsRepository } from '../../dist/infra/prisma/prisma-organizations.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { anOrganization } from './fixtures/catalog.ts';

function makeRepository(row: ReturnType<typeof anOrganization> | null) {
  const findUnique = mock.fn<(args: unknown) => Promise<unknown>>();
  findUnique.mock.mockImplementation(() => Promise.resolve(row));
  const repository = new PrismaOrganizationsRepository({ organization: { findUnique } } as unknown as PrismaService);
  return { repository, findUnique };
}

describe('PrismaOrganizationsRepository.findByAccountId', () => {
  test('gives the organization of the account with only the fields of an Organization', async () => {
    const { repository, findUnique } = makeRepository(anOrganization());

    const organization = await repository.findByAccountId(ACCOUNT_ID);

    assert.deepEqual(organization, anOrganization());
    assert.deepEqual(findUnique.mock.calls[0]?.arguments[0], {
      where: { accountId: ACCOUNT_ID },
      select: { accountId: true, name: true, verificationStatus: true },
    });
  });

  test('is undefined for an account that is not an organization', async () => {
    const { repository } = makeRepository(null);

    assert.equal(await repository.findByAccountId(ACCOUNT_ID), undefined);
  });
});
