// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { Transaction } from '../../dist/core/common/transaction.js';
import { PrismaMatchesRepository } from '../../dist/infra/prisma/prisma-matches.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';

const EVENT_ID = 'e0000000-0000-4000-8000-000000000001';
const APPLICATION_A = 'a9000000-0000-4000-8000-000000000001';
const APPLICATION_B = 'a9000000-0000-4000-8000-000000000002';
const VALID_UNTIL = new Date('2026-10-16T09:00:00.000Z');
const PROPOSAL = {
  applicationAId: APPLICATION_A,
  applicationBId: APPLICATION_B,
  source: 'instant' as const,
  score: 0.933,
  seed: 4_000_000_000,
  validUntil: VALID_UNTIL,
};

/** A transaction client; `paired` is how many of the two applications were still waiting. */
function aTransaction({ paired = 2 } = {}) {
  const tx = {
    $executeRaw: mock.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>>(() =>
      Promise.resolve(0),
    ),
    exclusion: {
      findMany: mock.fn(() => Promise.resolve([{ userId: ACCOUNT_ID, excludedUserId: OTHER_ACCOUNT_ID }])),
    },
    application: {
      updateMany: mock.fn<(args: unknown) => Promise<{ count: number }>>(() => Promise.resolve({ count: paired })),
    },
    match: {
      create: mock.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...args.data,
          id: 'match-1',
          score: { toNumber: () => PROPOSAL.score },
          status: 'proposed',
          cancelReason: null,
          createdAt: new Date('2026-10-15T09:00:00.000Z'),
          updatedAt: new Date('2026-10-15T09:00:00.000Z'),
        }),
      ),
    },
  };
  return { tx, transaction: tx as unknown as Transaction };
}

const repository = new PrismaMatchesRepository({} as unknown as PrismaService);

describe('PrismaMatchesRepository.lockEvent', () => {
  // FUNC-002
  test('takes a transaction-scoped advisory lock on the event', async () => {
    const { tx, transaction } = aTransaction();

    await repository.lockEvent(EVENT_ID, transaction);

    const [strings, key] = tx.$executeRaw.mock.calls[0]?.arguments ?? [];
    assert.match(strings?.join('?') ?? '', /pg_advisory_xact_lock\(hashtext\(\?\)\)/);
    assert.equal(key, `matching:${EVENT_ID}`);
  });
});

describe('PrismaMatchesRepository.findExcludedPairs', () => {
  test("gives the event's excluded pairs", async () => {
    const { tx, transaction } = aTransaction();

    const pairs = await repository.findExcludedPairs(EVENT_ID, transaction);

    assert.deepEqual(pairs, [[ACCOUNT_ID, OTHER_ACCOUNT_ID]]);
    assert.deepEqual(tx.exclusion.findMany.mock.calls[0]?.arguments, [
      { where: { eventId: EVENT_ID }, select: { userId: true, excludedUserId: true } },
    ]);
  });
});

describe('PrismaMatchesRepository.propose', () => {
  test('moves both applications from the pool to paired and stores the proposal', async () => {
    const { tx, transaction } = aTransaction();

    const match = await repository.propose(PROPOSAL, transaction);

    assert.deepEqual(tx.application.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: { in: [APPLICATION_A, APPLICATION_B] }, status: 'in_pool' },
      data: { status: 'paired' },
    });
    assert.equal(tx.match.create.mock.calls[0]?.arguments[0].data.seed, 4_000_000_000n);
    assert.deepEqual(match, {
      id: 'match-1',
      applicationAId: APPLICATION_A,
      applicationBId: APPLICATION_B,
      source: 'instant',
      score: 0.933,
      seed: 4_000_000_000,
      status: 'proposed',
      validUntil: VALID_UNTIL.toISOString(),
      createdAt: '2026-10-15T09:00:00.000Z',
    });
  });

  // FUNC-002: the second guard behind the lock.
  test('stores nothing when an application has left the pool', async () => {
    const { tx, transaction } = aTransaction({ paired: 1 });

    await assert.rejects(repository.propose(PROPOSAL, transaction));
    assert.equal(tx.match.create.mock.callCount(), 0);
  });
});
