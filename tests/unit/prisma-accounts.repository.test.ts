// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaAccountsRepository } from '../../dist/infra/prisma/prisma-accounts.repository.js';
import type { PersonalDataCipher } from '../../dist/infra/prisma/personal-data-cipher.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { aUniqueViolation } from './fixtures/prisma-errors.ts';

const GOOGLE_SUBJECT = '109876543210987654321';

/** An account row as Prisma returns it, registered with Google and still pending. */
function aPendingRow(id: string) {
  return { id, role: 'user', status: 'pending', contactIdentifier: null, dateOfBirth: null };
}

/** `existing` is the account another request created with the same Google subject, if any. */
function makeRepository({ existing }: { existing?: string } = {}) {
  const prisma = {
    account: { create: mock.fn(() => Promise.resolve(aPendingRow(ACCOUNT_ID))) },
    authMethod: {
      findUnique: mock.fn(() => Promise.resolve(existing ? { account: aPendingRow(existing) } : null)),
    },
  };
  const repository = new PrismaAccountsRepository(
    prisma as unknown as PrismaService,
    {} as unknown as PersonalDataCipher,
  );
  return { repository, prisma };
}

describe('PrismaAccountsRepository.createWithGoogle', () => {
  test('creates a pending account without a phone, with the Google sign-in method', async () => {
    const { repository, prisma } = makeRepository();

    const account = await repository.createWithGoogle(GOOGLE_SUBJECT);

    assert.deepEqual(prisma.account.create.mock.calls[0]?.arguments, [
      {
        data: {
          role: 'user',
          status: 'pending',
          authMethods: { create: { type: 'google', secret: GOOGLE_SUBJECT } },
        },
      },
    ]);
    assert.deepEqual(account, { id: ACCOUNT_ID, phone: null, role: 'user', status: 'pending', dateOfBirth: null });
  });

  // Two requests can both find no account; the unique index stops the second, which continues with the first's.
  test('returns the account a parallel request created for the same Google subject', async () => {
    const { repository, prisma } = makeRepository({ existing: OTHER_ACCOUNT_ID });
    prisma.account.create.mock.mockImplementation(() => Promise.reject(aUniqueViolation()));

    const account = await repository.createWithGoogle(GOOGLE_SUBJECT);

    assert.equal(account.id, OTHER_ACCOUNT_ID);
  });

  const rethrown = [
    { title: 'rethrows any other error', error: new Error('connection refused'), existing: OTHER_ACCOUNT_ID },
    {
      title: 'rethrows a violation of another unique index',
      error: aUniqueViolation({ index: 'accounts_contact_hash_key' }),
      existing: OTHER_ACCOUNT_ID,
    },
    {
      title: 'rethrows the violation when the other account is already gone',
      error: aUniqueViolation(),
      existing: undefined,
    },
  ];

  for (const { title, error, existing } of rethrown) {
    test(title, async () => {
      const { repository, prisma } = makeRepository({ existing });
      prisma.account.create.mock.mockImplementation(() => Promise.reject(error));

      await assert.rejects(repository.createWithGoogle(GOOGLE_SUBJECT), (thrown) => thrown === error);
    });
  }
});
