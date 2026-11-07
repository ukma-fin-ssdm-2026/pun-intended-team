// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaOrganizationsRepository } from '../../dist/infra/prisma/prisma-organizations.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { anOrganization } from './fixtures/catalog.ts';
import { aUniqueViolation } from './fixtures/prisma-errors.ts';

const ADMIN_ID = 'a0000000-0000-4000-8000-000000000009';
const REQUEST = { name: 'Natalka Park', description: 'Open-air cinema.', officialLink: 'https://natalka.park' };

/** The organization row as Prisma returns it. */
function aRow() {
  const { verifiedAt, ...organization } = anOrganization();
  return { ...organization, verifiedAt: verifiedAt ? new Date(verifiedAt) : null, verifiedById: ADMIN_ID };
}

function makeRepository() {
  const organization = {
    findUnique: mock.fn((): Promise<unknown> => Promise.resolve(aRow())),
    create: mock.fn((): Promise<unknown> => Promise.resolve(aRow())),
    updateMany: mock.fn<(args: unknown) => Promise<{ count: number }>>(() => Promise.resolve({ count: 1 })),
  };
  const repository = new PrismaOrganizationsRepository({ organization } as unknown as PrismaService);
  return { repository, organization };
}

describe('PrismaOrganizationsRepository.findByAccountId', () => {
  test('gives the organization of the account', async () => {
    const { repository } = makeRepository();

    assert.deepEqual(await repository.findByAccountId(ACCOUNT_ID), anOrganization());
  });

  test('is undefined for an account that is not an organization', async () => {
    const { repository, organization } = makeRepository();
    organization.findUnique.mock.mockImplementation(() => Promise.resolve(null));

    assert.equal(await repository.findByAccountId(ACCOUNT_ID), undefined);
  });
});

describe('PrismaOrganizationsRepository.create', () => {
  test('is undefined when the account has an organization already', async () => {
    const { repository, organization } = makeRepository();
    organization.create.mock.mockImplementation(() =>
      Promise.reject(aUniqueViolation({ index: 'organizations_pkey' })),
    );

    assert.equal(await repository.create(ACCOUNT_ID, REQUEST), undefined);
  });
});

// FR-003
describe('PrismaOrganizationsRepository.resubmit', () => {
  test('makes only a pending or rejected request pending again, without the earlier verification', async () => {
    const { repository, organization } = makeRepository();

    await repository.resubmit(ACCOUNT_ID, REQUEST);

    assert.deepEqual(organization.updateMany.mock.calls[0]?.arguments[0], {
      where: { accountId: ACCOUNT_ID, verificationStatus: { in: ['pending', 'rejected'] } },
      data: { ...REQUEST, verificationStatus: 'pending', verifiedById: null, verifiedAt: null },
    });
  });

  test('is undefined for an organization in another status', async () => {
    const { repository, organization } = makeRepository();
    organization.updateMany.mock.mockImplementation(() => Promise.resolve({ count: 0 }));

    assert.equal(await repository.resubmit(ACCOUNT_ID, REQUEST), undefined);
  });
});

// FR-003
describe('PrismaOrganizationsRepository.decide', () => {
  test('records who verified a pending request and when', async () => {
    const { repository, organization } = makeRepository();
    const at = new Date('2026-11-08T10:00:00Z');

    assert.equal(await repository.decide(ACCOUNT_ID, 'verified', ADMIN_ID, at), true);
    assert.deepEqual(organization.updateMany.mock.calls[0]?.arguments[0], {
      where: { accountId: ACCOUNT_ID, verificationStatus: 'pending' },
      data: { verificationStatus: 'verified', verifiedById: ADMIN_ID, verifiedAt: at },
    });
  });

  test('rejects a pending request without recording a verification, and is false when it was not pending', async () => {
    const { repository, organization } = makeRepository();
    organization.updateMany.mock.mockImplementation(() => Promise.resolve({ count: 0 }));

    assert.equal(await repository.decide(ACCOUNT_ID, 'rejected', ADMIN_ID, new Date()), false);
    assert.deepEqual(organization.updateMany.mock.calls[0]?.arguments[0], {
      where: { accountId: ACCOUNT_ID, verificationStatus: 'pending' },
      data: { verificationStatus: 'rejected' },
    });
  });
});
