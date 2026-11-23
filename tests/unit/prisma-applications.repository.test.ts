// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import { PrismaApplicationsRepository } from '../../dist/infra/prisma/prisma-applications.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { aUniqueViolation } from './fixtures/prisma-errors.ts';

const EVENT_ID = 'e0000000-0000-4000-8000-000000000001';
const SESSION_ID = '5e000000-0000-4000-8000-000000000001';
const LATER_SESSION_ID = '5e000000-0000-4000-8000-000000000002';
const RECORD = {
  userId: ACCOUNT_ID,
  eventId: EVENT_ID,
  sessionIds: [SESSION_ID, LATER_SESSION_ID],
  desiredCompany: 'company' as const,
  afterEventPlans: ['dinner' as const, 'walk' as const],
  preferredGender: 'female' as const,
  ageMin: 20,
  ageMax: null,
};

function anApplicationRow(plans: string[]) {
  return {
    id: 'a9000000-0000-4000-8000-000000000001',
    userId: ACCOUNT_ID,
    eventId: EVENT_ID,
    desiredCompany: 'casual',
    preferredGender: 'female',
    ageMin: 20,
    ageMax: null,
    status: 'in_pool',
    noResponseCount: 0,
    createdAt: new Date('2026-10-15T09:00:00.000Z'),
    updatedAt: new Date('2026-10-15T09:00:00.000Z'),
    sessions: [{ sessionId: SESSION_ID }, { sessionId: LATER_SESSION_ID }],
    afterEventPlans: plans.map((plan) => ({ plan })),
  };
}

function makeRepository(create: () => Promise<unknown>) {
  const application = { create: mock.fn<(args: unknown) => Promise<unknown>>(create) };
  return {
    repository: new PrismaApplicationsRepository({ application } as unknown as PrismaService),
    application,
  };
}

describe('PrismaApplicationsRepository.create', () => {
  test('stores the days and answers, with the database name of the company type, and gives the plans in order', async () => {
    const { repository, application } = makeRepository(() => Promise.resolve(anApplicationRow(['dinner', 'walk'])));

    const created = await repository.create(RECORD);

    const { data } = application.create.mock.calls[0]?.arguments[0] as { data: unknown };
    assert.deepEqual(data, {
      userId: ACCOUNT_ID,
      eventId: EVENT_ID,
      desiredCompany: 'casual',
      preferredGender: 'female',
      ageMin: 20,
      ageMax: null,
      sessions: { create: [{ sessionId: SESSION_ID }, { sessionId: LATER_SESSION_ID }] },
      afterEventPlans: { create: [{ plan: 'dinner' }, { plan: 'walk' }] },
    });
    assert.deepEqual(created.sessionIds, [SESSION_ID, LATER_SESSION_ID]);
    assert.equal(created.desiredCompany, 'company');
    assert.deepEqual(created.afterEventPlans, ['walk', 'dinner']);
    assert.deepEqual([created.preferredGender, created.ageMin, created.ageMax], ['female', 20, null]);
  });

  test('answers ALREADY_APPLIED when the active application index stops the write', async () => {
    const { repository } = makeRepository(() =>
      Promise.reject(aUniqueViolation({ index: 'applications_user_id_event_id_active_key' })),
    );

    await assert.rejects(
      repository.create(RECORD),
      (error: unknown) => error instanceof DomainError && error.code === 'ALREADY_APPLIED',
    );
  });

  test('passes on any other error', async () => {
    const violation = aUniqueViolation({ index: 'applications_pkey' });
    const { repository } = makeRepository(() => Promise.reject(violation));

    await assert.rejects(repository.create(RECORD), (error: unknown) => error === violation);
  });
});

describe('PrismaApplicationsRepository.create in a transaction', () => {
  test('writes with the transaction it is given', async () => {
    const { repository, application } = makeRepository(() => Promise.resolve(anApplicationRow([])));
    const tx = { application: { create: mock.fn(() => Promise.resolve(anApplicationRow([]))) } };

    await repository.create(RECORD, tx as unknown as Transaction);

    assert.equal(tx.application.create.mock.callCount(), 1);
    assert.equal(application.create.mock.callCount(), 0);
  });
});

describe('PrismaApplicationsRepository.findPool', () => {
  test('reads the applications waiting on any of the days, oldest first, in the transaction', async () => {
    const findMany = mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve([anApplicationRow([])]));
    const repository = new PrismaApplicationsRepository({} as unknown as PrismaService);

    const pool = await repository.findPool([SESSION_ID], { application: { findMany } } as unknown as Transaction);

    const { where, orderBy } = findMany.mock.calls[0]?.arguments[0] as { where: unknown; orderBy: unknown };
    assert.deepEqual(where, { status: 'in_pool', sessions: { some: { sessionId: { in: [SESSION_ID] } } } });
    assert.deepEqual(orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
    assert.deepEqual(
      pool.map(({ userId }) => userId),
      [ACCOUNT_ID],
    );
  });
});

// matching.md, rule 10: what a changed event does to the applications of its sessions.
describe('PrismaApplicationsRepository after an event change', () => {
  /** A transaction client that records every call. */
  function aTransactionClient() {
    const calls: [string, unknown][] = [];
    const record =
      (name: string, result: unknown = { count: 1 }) =>
      (args: unknown) => {
        calls.push([name, args]);
        return Promise.resolve(result);
      };
    const client = {
      application: { findMany: record('application.findMany', []), updateMany: record('application.updateMany') },
      applicationSession: {
        findMany: record('applicationSession.findMany', [{ applicationId: 'app-1' }, { applicationId: 'app-2' }]),
        createMany: record('applicationSession.createMany'),
        deleteMany: record('applicationSession.deleteMany'),
      },
    };
    return { calls, tx: client as unknown as Transaction };
  }

  const repository = new PrismaApplicationsRepository({} as unknown as PrismaService);
  const cases: { name: string; act: (tx: Transaction) => Promise<unknown>; calls: [string, unknown][] }[] = [
    {
      name: 'findBySessions reads the applications with the statuses that wait on one of the sessions',
      act: (tx) => repository.findBySessions([SESSION_ID], ['in_pool'], tx),
      calls: [
        [
          'application.findMany',
          {
            where: { status: { in: ['in_pool'] }, sessions: { some: { sessionId: { in: [SESSION_ID] } } } },
            include: {
              sessions: { select: { sessionId: true } },
              afterEventPlans: { select: { plan: true } },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        ],
      ],
    },
    {
      name: 'cancel changes only the applications still in one of the statuses',
      act: (tx) => repository.cancel(['app-1'], ['in_pool', 'paired'], tx),
      calls: [
        [
          'application.updateMany',
          { where: { id: { in: ['app-1'] }, status: { in: ['in_pool', 'paired'] } }, data: { status: 'cancelled' } },
        ],
      ],
    },
    {
      name: 'removeDays takes the sessions out of the applications',
      act: (tx) => repository.removeDays(['app-1'], [SESSION_ID], tx),
      calls: [
        [
          'applicationSession.deleteMany',
          { where: { applicationId: { in: ['app-1'] }, sessionId: { in: [SESSION_ID] } } },
        ],
      ],
    },
    {
      name: 'moveDay moves every application waiting on a session to another, once each',
      act: (tx) => repository.moveDay(SESSION_ID, LATER_SESSION_ID, tx),
      calls: [
        ['applicationSession.findMany', { where: { sessionId: SESSION_ID } }],
        [
          'applicationSession.createMany',
          {
            data: [
              { applicationId: 'app-1', sessionId: LATER_SESSION_ID },
              { applicationId: 'app-2', sessionId: LATER_SESSION_ID },
            ],
            skipDuplicates: true,
          },
        ],
        ['applicationSession.deleteMany', { where: { sessionId: SESSION_ID } }],
      ],
    },
  ];
  for (const { name, act, calls } of cases) {
    test(`${name}, in the transaction`, async () => {
      const client = aTransactionClient();

      await act(client.tx);

      assert.deepEqual(client.calls, calls);
    });
  }
});

// FR-018
describe('PrismaApplicationsRepository.findListed', () => {
  test('reads the applications with one of the statuses and those with no match not yet dismissed', async () => {
    const findMany = mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve([]));
    const repository = new PrismaApplicationsRepository({ application: { findMany } } as unknown as PrismaService);

    await repository.findListed(ACCOUNT_ID, ['in_pool', 'paired']);

    const { where } = findMany.mock.calls[0]?.arguments[0] as { where: unknown };
    assert.deepEqual(where, {
      userId: ACCOUNT_ID,
      OR: [{ status: { in: ['in_pool', 'paired'] } }, { status: 'no_match', dismissedAt: null }],
    });
  });
});

describe('PrismaApplicationsRepository.markNoMatch', () => {
  test('moves only the applications still in the pool, in the transaction', async () => {
    const updateMany = mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve({ count: 1 }));
    const repository = new PrismaApplicationsRepository({} as unknown as PrismaService);

    await repository.markNoMatch(['a', 'b'], { application: { updateMany } } as unknown as Transaction);

    assert.deepEqual(updateMany.mock.calls[0]?.arguments[0], {
      where: { id: { in: ['a', 'b'] }, status: 'in_pool' },
      data: { status: 'no_match' },
    });
  });
});

describe('PrismaApplicationsRepository.dismiss', () => {
  test('dismisses only an application with no match', async () => {
    const updateMany = mock.fn<(args: { where: unknown }) => Promise<{ count: number }>>(() =>
      Promise.resolve({ count: 0 }),
    );
    const repository = new PrismaApplicationsRepository({ application: { updateMany } } as unknown as PrismaService);

    assert.equal(await repository.dismiss('a'), false);
    assert.deepEqual(updateMany.mock.calls[0]?.arguments[0].where, { id: 'a', status: 'no_match' });
  });
});
