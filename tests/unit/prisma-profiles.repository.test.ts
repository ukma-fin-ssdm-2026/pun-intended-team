// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { PrismaProfilesRepository } from '../../dist/infra/prisma/prisma-profiles.repository.js';
import type { PersonalDataCipher } from '../../dist/infra/prisma/personal-data-cipher.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { aUniqueViolation } from './fixtures/prisma-errors.ts';

const INTEREST_ID = 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e02';

// Stands in for AES-GCM: readable in assertions, and decrypt undoes encrypt.
const cipher = {
  encrypt: (text: string) => new TextEncoder().encode(`enc:${text}`),
  decrypt: (stored: Uint8Array) => new TextDecoder().decode(stored).replace(/^enc:/, ''),
};

/** A profile row as Prisma returns it with its interests and networks. */
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
    linkedAccounts: [{ app: 'telegram', username: cipher.encrypt('olena_k') }],
    ...overrides,
  };
}

/** `write` answers create and update; `row` is what findUnique reads, `found` what findFirst and findMany read. */
function makeRepository({
  write = () => Promise.resolve(aRow()),
  row = aRow(),
  found = null,
}: { write?: () => Promise<unknown>; row?: unknown; found?: unknown } = {}) {
  const prisma = {
    profile: {
      findUnique: mock.fn(() => Promise.resolve(row)),
      findFirst: mock.fn<(args: { where: unknown }) => Promise<unknown>>(() => Promise.resolve(found)),
      findMany: mock.fn<(args: { where: unknown }) => Promise<unknown>>(() => Promise.resolve(found ?? [])),
      findUniqueOrThrow: mock.fn(() => row),
      create: mock.fn<(args: { data: unknown }) => Promise<unknown>>(write),
      update: mock.fn<(args: { data: unknown }) => Promise<unknown>>(write),
    },
    profileInterest: {
      deleteMany: mock.fn<(args: unknown) => string>(() => 'delete'),
      createMany: mock.fn<(args: { data: { profileId: string; interestId: string }[] }) => string>(() => 'create'),
    },
    linkedAccount: {
      deleteMany: mock.fn<(args: unknown) => string>(() => 'delete'),
      createMany: mock.fn<(args: { data: { profileId: string; app: string; username: Uint8Array }[] }) => string>(
        () => 'create',
      ),
    },
    $transaction: mock.fn((steps: unknown[]) => Promise.resolve(steps)),
  };
  const repository = new PrismaProfilesRepository(
    prisma as unknown as PrismaService,
    cipher as unknown as PersonalDataCipher,
  );
  return { repository, prisma };
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
      linkedAccounts: [{ network: 'telegram', username: 'olena_k' }],
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

  test('lists the networks in the order of socialNetworks and skips one the code no longer knows', async () => {
    const { repository } = makeRepository({
      row: aRow({
        linkedAccounts: [
          { app: 'facebook', username: cipher.encrypt('olena.k') },
          { app: 'myspace', username: cipher.encrypt('olena') },
          { app: 'telegram', username: cipher.encrypt('olena_k') },
        ],
      }),
    });

    const profile = await repository.findByAccountId(ACCOUNT_ID);

    assert.deepEqual(profile?.linkedAccounts, [
      { network: 'telegram', username: 'olena_k' },
      { network: 'facebook', username: 'olena.k' },
    ]);
  });
});

describe('PrismaProfilesRepository.findSummaries', () => {
  test('asks only for the given accounts and their public names', async () => {
    const summary = { accountId: ACCOUNT_ID, username: 'olena_k', displayName: 'Olena' };
    const { repository, prisma } = makeRepository({ found: [summary] });

    assert.deepEqual(await repository.findSummaries([ACCOUNT_ID]), [summary]);
    assert.deepEqual(prisma.profile.findMany.mock.calls[0]?.arguments[0].where, { accountId: { in: [ACCOUNT_ID] } });
  });
});

describe('PrismaProfilesRepository.isUsernameTaken', () => {
  test('compares the username in any letter case and leaves out the given account', async () => {
    const { repository, prisma } = makeRepository({ found: { accountId: OTHER_ACCOUNT_ID } });

    assert.equal(await repository.isUsernameTaken('Olena_K', ACCOUNT_ID), true);
    assert.deepEqual(prisma.profile.findFirst.mock.calls[0]?.arguments[0].where, {
      username: { equals: 'Olena_K', mode: 'insensitive' },
      NOT: { accountId: ACCOUNT_ID },
    });
  });

  test('is false when no other profile has it', async () => {
    const { repository } = makeRepository({ found: null });

    assert.equal(await repository.isUsernameTaken('olena_k'), false);
  });
});

describe('PrismaProfilesRepository.create', () => {
  test('leaves the format null until it is picked', async () => {
    const { repository } = makeRepository({ write: () => Promise.resolve(aRow({ communicationFormat: null })) });

    const profile = await repository.create(ACCOUNT_ID, { username: 'olena_k', displayName: 'Olena' });

    assert.equal(profile.communicationFormat, null);
  });

  // The service checks the username first; a request at the same time can still reach the unique index.
  test('reports a username taken meanwhile as USERNAME_TAKEN', async () => {
    const { repository } = makeRepository({
      write: () => Promise.reject(aUniqueViolation({ index: 'profiles_username_lower_key' })),
    });

    await assert.rejects(
      repository.create(ACCOUNT_ID, { username: 'olena_k', displayName: 'Olena' }),
      isDomainError('USERNAME_TAKEN'),
    );
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

    const data = prisma.profile.update.mock.calls[0]?.arguments[0].data;
    assert.deepEqual(data, { description: 'Hi', communicationFormat: 'casual' });
  });

  test('stores an emptied description and occupation as null, as a new profile has them', async () => {
    const { repository, prisma } = makeRepository();

    await repository.update(ACCOUNT_ID, { description: '', occupation: '' });

    const data = prisma.profile.update.mock.calls[0]?.arguments[0].data;
    assert.deepEqual(data, { description: null, occupation: null });
  });

  test('leaves the format out when it is not changed', async () => {
    const { repository, prisma } = makeRepository();

    await repository.update(ACCOUNT_ID, { displayName: 'Olia' });

    const data = prisma.profile.update.mock.calls[0]?.arguments[0].data;
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

describe('PrismaProfilesRepository.replaceInterests', () => {
  test('replaces the set in one transaction and returns the profile read after it', async () => {
    const { repository, prisma } = makeRepository();

    const profile = await repository.replaceInterests(ACCOUNT_ID, [INTEREST_ID]);

    assert.deepEqual(prisma.$transaction.mock.calls[0]?.arguments[0]?.slice(0, 2), ['delete', 'create']);
    assert.deepEqual(prisma.profileInterest.deleteMany.mock.calls[0]?.arguments, [
      { where: { profileId: ACCOUNT_ID } },
    ]);
    assert.deepEqual(prisma.profileInterest.createMany.mock.calls[0]?.arguments[0].data, [
      { profileId: ACCOUNT_ID, interestId: INTEREST_ID },
    ]);
    assert.deepEqual(profile.interestIds, [INTEREST_ID]);
  });
});

describe('PrismaProfilesRepository.replaceLinkedAccounts', () => {
  test('replaces the set in one transaction and stores the usernames encrypted', async () => {
    const { repository, prisma } = makeRepository();

    await repository.replaceLinkedAccounts(ACCOUNT_ID, [{ network: 'instagram', username: 'olena.k' }]);

    assert.deepEqual(prisma.$transaction.mock.calls[0]?.arguments[0]?.slice(0, 2), ['delete', 'create']);
    assert.deepEqual(prisma.linkedAccount.deleteMany.mock.calls[0]?.arguments, [{ where: { profileId: ACCOUNT_ID } }]);
    const data = prisma.linkedAccount.createMany.mock.calls[0]?.arguments[0].data ?? [];
    assert.deepEqual(
      data.map((item) => ({ ...item, username: new TextDecoder().decode(item.username) })),
      [{ profileId: ACCOUNT_ID, app: 'instagram', username: 'enc:olena.k' }],
    );
  });
});
