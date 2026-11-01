// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { PrismaProfilesRepository } from '../../dist/infra/prisma/prisma-profiles.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { aUniqueViolation } from './fixtures/prisma-errors.ts';

const INTEREST_ID = 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e02';

/** A profile row as Prisma returns it with its interests. */
function aRow(overrides: Record<string, unknown> = {}) {
  return {
    accountId: ACCOUNT_ID,
    username: 'olena_k',
    displayName: 'Olena',
    description: 'Cinema and walks.',
    occupation: 'Student',
    communicationFormat: 'friends',
    sharePhone: true,
    profileInterests: [{ interestId: INTEREST_ID }],
    ...overrides,
  };
}

/** `write` answers create and update; `row` is what findUnique reads. */
function makeRepository({
  write = () => Promise.resolve(aRow()),
  row = aRow(),
}: { write?: () => Promise<unknown>; row?: unknown } = {}) {
  const prisma = {
    profile: { findUnique: mock.fn(() => Promise.resolve(row)), create: mock.fn(write), update: mock.fn(write) },
  };
  return { repository: new PrismaProfilesRepository(prisma as unknown as PrismaService), prisma };
}

function isDomainError(code: string) {
  return (error: unknown) => error instanceof DomainError && error.code === code;
}

describe('PrismaProfilesRepository.findByAccountId', () => {
  test('returns the profile with its interest ids', async () => {
    const { repository } = makeRepository();

    assert.deepEqual(await repository.findByAccountId(ACCOUNT_ID), {
      accountId: ACCOUNT_ID,
      username: 'olena_k',
      displayName: 'Olena',
      description: 'Cinema and walks.',
      occupation: 'Student',
      communicationFormat: 'friends',
      sharePhone: true,
      interestIds: [INTEREST_ID],
    });
  });

  test("reads the database's casual as company", async () => {
    const { repository } = makeRepository({ row: aRow({ communicationFormat: 'casual' }) });

    assert.equal((await repository.findByAccountId(ACCOUNT_ID))?.communicationFormat, 'company');
  });

  test('reads a missing description and occupation as empty', async () => {
    const { repository } = makeRepository({ row: aRow({ description: null, occupation: null }) });

    const profile = await repository.findByAccountId(ACCOUNT_ID);

    assert.equal(profile?.description, '');
    assert.equal(profile?.occupation, '');
  });

  test('is undefined when the account has no profile', async () => {
    const { repository } = makeRepository({ row: null });

    assert.equal(await repository.findByAccountId(ACCOUNT_ID), undefined);
  });
});

describe('PrismaProfilesRepository.create', () => {
  test('leaves the format null until it is picked', async () => {
    const { repository } = makeRepository({ write: () => Promise.resolve(aRow({ communicationFormat: null })) });

    const profile = await repository.create(ACCOUNT_ID, { username: 'olena_k', displayName: 'Olena' });

    assert.equal(profile.communicationFormat, null);
  });

  // The service checks first; a second request at the same time can still reach the primary key.
  test('reports a profile created meanwhile as PROFILE_EXISTS', async () => {
    const { repository } = makeRepository({
      write: () => Promise.reject(aUniqueViolation({ index: 'profiles_pkey' })),
    });

    await assert.rejects(
      repository.create(ACCOUNT_ID, { username: 'olena_k', displayName: 'Olena' }),
      isDomainError('PROFILE_EXISTS'),
    );
  });
});

describe('PrismaProfilesRepository.update', () => {
  test('stores company as casual', async () => {
    const { repository, prisma } = makeRepository();

    await repository.update(ACCOUNT_ID, { communicationFormat: 'company', description: 'Hi' });

    const [{ data }] = prisma.profile.update.mock.calls[0]?.arguments as [{ data: unknown }];
    assert.deepEqual(data, { description: 'Hi', communicationFormat: 'casual' });
  });

  test('leaves the format out when it is not changed', async () => {
    const { repository, prisma } = makeRepository();

    await repository.update(ACCOUNT_ID, { displayName: 'Olia' });

    const [{ data }] = prisma.profile.update.mock.calls[0]?.arguments as [{ data: unknown }];
    assert.deepEqual(data, { displayName: 'Olia' });
  });

  // The service checks first; a second request at the same time can still reach the unique index.
  test('reports a username taken meanwhile as USERNAME_TAKEN', async () => {
    const { repository } = makeRepository({
      write: () => Promise.reject(aUniqueViolation({ index: 'profiles_username_lower_key' })),
    });

    await assert.rejects(repository.update(ACCOUNT_ID, { username: 'Olena_K' }), isDomainError('USERNAME_TAKEN'));
  });

  test('passes on any other error', async () => {
    const failure = new Error('connection lost');
    const { repository } = makeRepository({ write: () => Promise.reject(failure) });

    await assert.rejects(repository.update(ACCOUNT_ID, { displayName: 'Olia' }), failure);
  });
});
