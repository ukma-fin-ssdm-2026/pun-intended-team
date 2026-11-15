// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaEventSessionsRepository } from '../../dist/infra/prisma/prisma-event-sessions.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import { EVENT_ID } from './fixtures/catalog.ts';

const SESSION_ID = '5e000000-0000-4000-8000-000000000001';
const STARTS_AT = new Date('2026-10-22T16:00:00.000Z');
const EVENT_TIMES = { startsAt: STARTS_AT, endsAt: new Date('2026-10-22T18:00:00.000Z') };
const ROW = { id: SESSION_ID, eventId: EVENT_ID, startsAt: STARTS_AT, status: 'scheduled', event: EVENT_TIMES };
const WITH_EVENT_TIMES = { event: { select: { startsAt: true, endsAt: true } } };

function makeRepository() {
  const eventSession = {
    createManyAndReturn: mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve([])),
    findMany: mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve([ROW])),
  };
  return {
    repository: new PrismaEventSessionsRepository({ eventSession } as unknown as PrismaService),
    eventSession,
  };
}

describe('PrismaEventSessionsRepository.findOrCreateMany', () => {
  test('inserts the sessions that do not exist in one query, then reads them all in another', async () => {
    const { repository, eventSession } = makeRepository();
    const later = new Date('2026-10-23T16:00:00.000Z');

    const [session] = await repository.findOrCreateMany(EVENT_ID, [STARTS_AT, later]);

    assert.deepEqual(eventSession.createManyAndReturn.mock.calls[0]?.arguments[0], {
      data: [
        { eventId: EVENT_ID, startsAt: STARTS_AT },
        { eventId: EVENT_ID, startsAt: later },
      ],
      skipDuplicates: true,
      select: { id: true },
    });
    assert.deepEqual(eventSession.findMany.mock.calls[0]?.arguments[0], {
      where: { eventId: EVENT_ID, startsAt: { in: [STARTS_AT, later] } },
      include: WITH_EVENT_TIMES,
    });
    assert.deepEqual(session, {
      id: SESSION_ID,
      eventId: EVENT_ID,
      startsAt: '2026-10-22T16:00:00.000Z',
      status: 'scheduled',
      event: { startsAt: '2026-10-22T16:00:00.000Z', endsAt: '2026-10-22T18:00:00.000Z' },
      created: false,
    });
  });

  test('marks only the sessions this call inserted as created', async () => {
    const { repository, eventSession } = makeRepository();
    eventSession.createManyAndReturn.mock.mockImplementation(() => Promise.resolve([{ id: SESSION_ID }]));

    const [session] = await repository.findOrCreateMany(EVENT_ID, [STARTS_AT]);

    assert.equal(session?.created, true);
  });

  test('writes and reads in the transaction it is given', async () => {
    const { repository, eventSession } = makeRepository();
    const tx = {
      eventSession: {
        createManyAndReturn: mock.fn(() => Promise.resolve([])),
        findMany: mock.fn(() => Promise.resolve([ROW])),
      },
    };

    await repository.findOrCreateMany(EVENT_ID, [STARTS_AT], tx as unknown as Transaction);

    assert.equal(tx.eventSession.createManyAndReturn.mock.callCount(), 1);
    assert.equal(tx.eventSession.findMany.mock.callCount(), 1);
    assert.equal(eventSession.findMany.mock.callCount(), 0);
  });
});

describe('PrismaEventSessionsRepository.findByIds', () => {
  test('reads the sessions with these ids', async () => {
    const { repository, eventSession } = makeRepository();

    const sessions = await repository.findByIds([SESSION_ID]);

    assert.deepEqual(eventSession.findMany.mock.calls[0]?.arguments[0], {
      where: { id: { in: [SESSION_ID] } },
      include: WITH_EVENT_TIMES,
    });
    assert.equal(sessions[0]?.startsAt, '2026-10-22T16:00:00.000Z');
  });
});
