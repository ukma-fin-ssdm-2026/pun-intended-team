// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaEventSessionsRepository } from '../../dist/infra/prisma/prisma-event-sessions.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { EVENT_ID } from './fixtures/catalog.ts';

const SESSION_ID = '5e000000-0000-4000-8000-000000000001';
const STARTS_AT = new Date('2026-10-22T16:00:00.000Z');

function makeRepository() {
  const eventSession = {
    createMany: mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve({ count: 0 })),
    findMany: mock.fn<(args: unknown) => Promise<unknown>>(() =>
      Promise.resolve([{ id: SESSION_ID, eventId: EVENT_ID, startsAt: STARTS_AT, status: 'scheduled' }]),
    ),
    findUniqueOrThrow: mock.fn<(args: unknown) => Promise<unknown>>(() =>
      Promise.resolve({ id: SESSION_ID, eventId: EVENT_ID, startsAt: STARTS_AT, status: 'scheduled' }),
    ),
  };
  return {
    repository: new PrismaEventSessionsRepository({ eventSession } as unknown as PrismaService),
    eventSession,
  };
}

describe('PrismaEventSessionsRepository.findOrCreate', () => {
  test('inserts the session unless it exists, then reads it by event and start', async () => {
    const { repository, eventSession } = makeRepository();

    const session = await repository.findOrCreate(EVENT_ID, STARTS_AT);

    assert.deepEqual(eventSession.createMany.mock.calls[0]?.arguments[0], {
      data: [{ eventId: EVENT_ID, startsAt: STARTS_AT }],
      skipDuplicates: true,
    });
    assert.deepEqual(eventSession.findUniqueOrThrow.mock.calls[0]?.arguments[0], {
      where: { eventId_startsAt: { eventId: EVENT_ID, startsAt: STARTS_AT } },
    });
    assert.deepEqual(session, {
      id: SESSION_ID,
      eventId: EVENT_ID,
      startsAt: '2026-10-22T16:00:00.000Z',
      status: 'scheduled',
    });
  });
});

describe('PrismaEventSessionsRepository.findByIds', () => {
  test('reads the sessions with these ids', async () => {
    const { repository, eventSession } = makeRepository();

    const sessions = await repository.findByIds([SESSION_ID]);

    assert.deepEqual(eventSession.findMany.mock.calls[0]?.arguments[0], { where: { id: { in: [SESSION_ID] } } });
    assert.equal(sessions[0]?.startsAt, '2026-10-22T16:00:00.000Z');
  });
});
