// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import { PrismaApplicationsRepository } from '../../dist/infra/prisma/prisma-applications.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
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
};

function anApplicationRow(plans: string[]) {
  return {
    id: 'a9000000-0000-4000-8000-000000000001',
    userId: ACCOUNT_ID,
    eventId: EVENT_ID,
    desiredCompany: 'casual',
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
      sessions: { create: [{ sessionId: SESSION_ID }, { sessionId: LATER_SESSION_ID }] },
      afterEventPlans: { create: [{ plan: 'dinner' }, { plan: 'walk' }] },
    });
    assert.deepEqual(created.sessionIds, [SESSION_ID, LATER_SESSION_ID]);
    assert.equal(created.desiredCompany, 'company');
    assert.deepEqual(created.afterEventPlans, ['walk', 'dinner']);
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
