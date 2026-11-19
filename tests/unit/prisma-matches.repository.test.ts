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

/**
 * A transaction client; `paired` is how many of the two applications were still waiting, `answered` how many matches
 * were still in the status an answer expects.
 */
function aTransaction({
  paired = 2,
  answered = 1,
  pending = [] as { id: string; applicationAId: string; applicationBId: string }[],
} = {}) {
  const tx = {
    $executeRaw: mock.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>>(() =>
      Promise.resolve(0),
    ),
    exclusion: {
      findMany: mock.fn(() => Promise.resolve([{ userId: ACCOUNT_ID, excludedUserId: OTHER_ACCOUNT_ID }])),
      create: mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve({})),
    },
    application: {
      updateMany: mock.fn<(args: unknown) => Promise<{ count: number }>>(() => Promise.resolve({ count: paired })),
    },
    match: {
      updateMany: mock.fn<(args: unknown) => Promise<{ count: number }>>(() => Promise.resolve({ count: answered })),
      findFirst: mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve(null)),
      findMany: mock.fn<(args: unknown) => Promise<unknown[]>>(() => Promise.resolve(pending)),
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

/** Both applications of RECORD that were still paired went back to the pool. */
function assertBothReturnedToPool(tx: ReturnType<typeof aTransaction>['tx']) {
  assert.deepEqual(tx.application.updateMany.mock.calls[0]?.arguments[0], {
    where: { id: { in: [APPLICATION_A, APPLICATION_B] }, status: 'paired' },
    data: { status: 'in_pool' },
  });
}

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

function anApplication(id: string, userId: string) {
  return {
    id,
    userId,
    eventId: EVENT_ID,
    sessionIds: ['5e000000-0000-4000-8000-000000000001'],
    desiredCompany: 'company' as const,
    afterEventPlans: [],
    status: 'paired' as const,
    createdAt: '2026-10-15T09:00:00.000Z',
  };
}

const RECORD = {
  ...PROPOSAL,
  id: 'match-1',
  status: 'accepted_b' as const,
  validUntil: VALID_UNTIL.toISOString(),
  createdAt: '2026-10-15T09:00:00.000Z',
  eventId: EVENT_ID,
  applicationA: anApplication(APPLICATION_A, ACCOUNT_ID),
  applicationB: anApplication(APPLICATION_B, OTHER_ACCOUNT_ID),
};

describe('PrismaMatchesRepository.setStatus', () => {
  test('moves the match on only from the status the answer expects', async () => {
    const { tx, transaction } = aTransaction();

    await repository.setStatus('match-1', 'accepted_b', 'mutual', transaction);

    assert.deepEqual(tx.match.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: 'match-1', status: { in: ['accepted_b'] } },
      data: { status: 'mutual' },
    });
  });

  test('throws when the match changed meanwhile', async () => {
    const { transaction } = aTransaction({ answered: 0 });

    await assert.rejects(repository.setStatus('match-1', 'proposed', 'accepted_a', transaction));
  });
});

// matching.md, rule 5
describe('PrismaMatchesRepository.decline', () => {
  test('declines the match, keeps the two apart at the event and returns both to the pool', async () => {
    const { tx, transaction } = aTransaction();

    await repository.decline(RECORD, ACCOUNT_ID, transaction);

    assert.deepEqual(tx.match.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: 'match-1', status: { in: ['proposed', 'accepted_a', 'accepted_b'] } },
      data: { status: 'declined' },
    });
    assert.deepEqual(tx.exclusion.create.mock.calls[0]?.arguments[0], {
      data: {
        userId: ACCOUNT_ID,
        excludedUserId: OTHER_ACCOUNT_ID,
        eventId: EVENT_ID,
        matchId: 'match-1',
        reason: 'declined',
      },
    });
    assert.deepEqual(tx.application.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: { in: [APPLICATION_A, APPLICATION_B] }, status: 'paired' },
      data: { status: 'in_pool' },
    });
  });

  test('keeps out the user who declined, whichever side they are on', async () => {
    const { tx, transaction } = aTransaction();

    await repository.decline(RECORD, OTHER_ACCOUNT_ID, transaction);

    const { data } = tx.exclusion.create.mock.calls[0]?.arguments[0] as { data: Record<string, string> };
    assert.equal(data.userId, OTHER_ACCOUNT_ID);
    assert.equal(data.excludedUserId, ACCOUNT_ID);
  });
});

// UC-001 A5
describe('PrismaMatchesRepository.cancelForWithdrawal', () => {
  test('cancels the match and returns the other application to the pool', async () => {
    const { tx, transaction } = aTransaction();

    await repository.cancelForWithdrawal(RECORD, APPLICATION_A, transaction);

    assert.deepEqual(tx.match.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: 'match-1', status: { in: ['proposed', 'accepted_a', 'accepted_b'] } },
      data: { status: 'cancelled', cancelReason: 'participant_withdrew' },
    });
    assert.deepEqual(tx.application.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: APPLICATION_B, status: 'paired' },
      data: { status: 'in_pool' },
    });
  });
});

// matching.md, rule 10: what a changed event does to pending proposals.
describe('PrismaMatchesRepository.cancelPending', () => {
  test('cancels the pending proposals for the reason, and returns to the pool only the side not cancelled too', async () => {
    const { tx, transaction } = aTransaction({
      pending: [{ id: 'match-1', applicationAId: APPLICATION_A, applicationBId: APPLICATION_B }],
    });

    await repository.cancelPending([APPLICATION_A], 'event_cancelled', transaction);

    assert.deepEqual(tx.match.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: { in: ['match-1'] }, status: { in: ['proposed', 'accepted_a', 'accepted_b'] } },
      data: { status: 'cancelled', cancelReason: 'event_cancelled' },
    });
    assert.deepEqual(tx.application.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: { in: [APPLICATION_B] }, status: 'paired' },
      data: { status: 'in_pool' },
    });
  });

  test('changes nothing when there is no pending proposal', async () => {
    const { tx, transaction } = aTransaction();

    await repository.cancelPending([APPLICATION_A], 'event_cancelled', transaction);

    assert.equal(tx.match.updateMany.mock.callCount() + tx.application.updateMany.mock.callCount(), 0);
  });
});

describe('PrismaMatchesRepository.cancelAndReturnBoth', () => {
  test('cancels the pending proposal for the reason and returns both applications to the pool', async () => {
    const { tx, transaction } = aTransaction();

    await repository.cancelAndReturnBoth(RECORD, 'event_changed', transaction);

    assert.deepEqual(tx.match.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: RECORD.id, status: { in: ['proposed', 'accepted_a', 'accepted_b'] } },
      data: { status: 'cancelled', cancelReason: 'event_changed' },
    });
    assertBothReturnedToPool(tx);
  });

  test('fails, rolling the change back, when the proposal was answered meanwhile', async () => {
    const { transaction } = aTransaction({ answered: 0 });

    await assert.rejects(repository.cancelAndReturnBoth(RECORD, 'event_changed', transaction), /changed/);
  });
});

describe('PrismaMatchesRepository.cancelMutual', () => {
  test('cancels only matches still mutual, for the reason, and returns their paired applications to the pool', async () => {
    const { tx, transaction } = aTransaction();

    await repository.cancelMutual([{ ...RECORD, status: 'mutual' }], 'event_cancelled', transaction);

    assert.deepEqual(tx.match.updateMany.mock.calls[0]?.arguments[0], {
      where: { id: { in: [RECORD.id] }, status: 'mutual' },
      data: { status: 'cancelled', cancelReason: 'event_cancelled' },
    });
    assertBothReturnedToPool(tx);
  });

  test('changes nothing when there is no match', async () => {
    const { tx, transaction } = aTransaction();

    await repository.cancelMutual([], 'event_cancelled', transaction);

    assert.equal(tx.match.updateMany.mock.callCount(), 0);
    assert.equal(tx.application.updateMany.mock.callCount(), 0);
  });
});

describe('PrismaMatchesRepository.findByApplication', () => {
  test('looks for the match on either side of the application', async () => {
    const { tx, transaction } = aTransaction();

    const match = await repository.findByApplication(APPLICATION_A, ['proposed', 'mutual'], transaction);

    assert.equal(match, undefined);
    const { where } = tx.match.findFirst.mock.calls[0]?.arguments[0] as { where: unknown };
    assert.deepEqual(where, {
      status: { in: ['proposed', 'mutual'] },
      OR: [{ applicationAId: APPLICATION_A }, { applicationBId: APPLICATION_A }],
    });
  });
});
