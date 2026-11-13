// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { Prisma } from '../../dist/infra/prisma/generated/client.js';
import { ImportPrismaService } from '../../dist/infra/prisma/import-prisma.service.js';
import { PrismaImportedEventsRepository } from '../../dist/infra/prisma/prisma-imported-events.repository.js';
import { aVenueRow } from './fixtures/catalog-rows.ts';

const RUN_ID = 'f0000000-0000-4000-8000-0000000000aa';

function makeRepository() {
  const prisma = {
    event: {
      findMany: mock.fn((): Promise<unknown[]> => Promise.resolve([])),
      update: mock.fn(() => Promise.resolve({})),
      updateMany: mock.fn(() => Promise.resolve({ count: 2 })),
    },
    importRun: {
      update: mock.fn(() => Promise.resolve({})),
      updateMany: mock.fn(() => Promise.resolve({ count: 0 })),
      findFirst: mock.fn((): Promise<unknown> => Promise.resolve(null)),
    },
    skippedRecord: { create: mock.fn(() => Promise.resolve({ id: 'skipped' })) },
    venue: {
      findMany: mock.fn((): Promise<unknown[]> => Promise.resolve([])),
      update: mock.fn((): Promise<unknown> => Promise.resolve(aVenueRow())),
    },
  };
  return { repository: new PrismaImportedEventsRepository(prisma as unknown as ImportPrismaService), prisma };
}

describe('PrismaImportedEventsRepository.updateEvent', () => {
  test('changes only an imported event, and publishes it, so an organization event is never touched', async () => {
    const { repository, prisma } = makeRepository();
    const fields = {
      title: 'Jazz evening',
      description: 'Live quartet.',
      categoryId: 'c0000000-0000-4000-8000-000000000001',
      venueId: 'b0000000-0000-4000-8000-000000000001',
      startsAt: '2026-10-22T16:00:00.000Z',
      endsAt: '2026-10-22T19:00:00.000Z',
      imageUrl: 'https://images.example/jazz.jpg',
      sourceUrl: 'https://tickets.example/jazz-evening/',
    };

    await repository.updateEvent('e0000000-0000-4000-8000-000000000001', fields);

    assert.deepEqual(prisma.event.update.mock.calls[0]?.arguments, [
      {
        where: { id: 'e0000000-0000-4000-8000-000000000001', source: 'import' },
        data: { ...fields, startsAt: new Date(fields.startsAt), endsAt: new Date(fields.endsAt), status: 'published' },
      },
    ]);
  });
});

describe('PrismaImportedEventsRepository venues', () => {
  test('finds only imported venues, oldest first, so the import reuses the first one it saved', async () => {
    const { repository, prisma } = makeRepository();
    prisma.venue.findMany.mock.mockImplementation(() => Promise.resolve([aVenueRow()]));

    const venues = await repository.findVenues();

    assert.deepEqual(prisma.venue.findMany.mock.calls[0]?.arguments, [
      { where: { source: 'import' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    ]);
    assert.deepEqual(venues[0]?.location, { lat: 50.4825, lng: 30.5181 });
  });

  test('moves only an imported venue, so an organization venue keeps its place', async () => {
    const { repository, prisma } = makeRepository();

    await repository.updateVenueLocation('b0000000-0000-4000-8000-000000000001', { lat: 50.436261, lng: 30.519504 });

    assert.deepEqual(prisma.venue.update.mock.calls[0]?.arguments, [
      {
        where: { id: 'b0000000-0000-4000-8000-000000000001', source: 'import' },
        data: { latitude: 50.436261, longitude: 30.519504 },
      },
    ]);
  });
});

describe('PrismaImportedEventsRepository.failUnfinishedRuns', () => {
  test('marks only the provider’s running runs as failed, and leaves finished_at empty', async () => {
    const { repository, prisma } = makeRepository();

    await repository.failUnfinishedRuns('karabas');

    assert.deepEqual(prisma.importRun.updateMany.mock.calls[0]?.arguments, [
      { where: { provider: 'karabas', status: 'running' }, data: { status: 'failed' } },
    ]);
  });
});

// ADR-006, decision 8
describe('PrismaImportedEventsRepository.findOtherProvidersEvents', () => {
  test('looks only at the other providers’ published imported events at the venue and the start time', async () => {
    const { repository, prisma } = makeRepository();

    assert.deepEqual(
      await repository.findOtherProvidersEvents(
        'artwizard',
        'b0000000-0000-4000-8000-000000000001',
        '2026-10-22T16:00:00.000Z',
      ),
      [],
    );
    assert.deepEqual(prisma.event.findMany.mock.calls[0]?.arguments, [
      {
        where: {
          source: 'import',
          status: 'published',
          provider: { not: 'artwizard' },
          venueId: 'b0000000-0000-4000-8000-000000000001',
          startsAt: new Date('2026-10-22T16:00:00.000Z'),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    ]);
  });
});

// ADR-006, decision 9: a failed or unfinished run counts too, so the guard never allows a second run in a day.
describe('PrismaImportedEventsRepository.lastRunStart', () => {
  test('reads the start of the provider’s latest run, whatever its status', async () => {
    const { repository, prisma } = makeRepository();
    const startedAt = new Date('2026-11-11T02:00:00.000Z');
    prisma.importRun.findFirst.mock.mockImplementation(() => Promise.resolve({ startedAt }));

    assert.deepEqual(await repository.lastRunStart('artwizard'), startedAt);
    assert.deepEqual(prisma.importRun.findFirst.mock.calls[0]?.arguments, [
      { where: { provider: 'artwizard' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } },
    ]);
  });

  test('is undefined for a provider that never ran', async () => {
    const { repository } = makeRepository();

    assert.equal(await repository.lastRunStart('artwizard'), undefined);
  });
});

// ADR-006: removed and cancelled events
describe('PrismaImportedEventsRepository.cancelUnseen', () => {
  test('cancels only the provider’s published imported events in the range that were not seen', async () => {
    const { repository, prisma } = makeRepository();
    const range = { from: '2026-11-07T10:00:00.000Z', to: '2026-12-05T21:59:59.999Z' };

    const cancelled = await repository.cancelUnseen('karabas', ['lama-15', 'sting-2'], range);

    assert.equal(cancelled, 2);
    assert.deepEqual(prisma.event.updateMany.mock.calls[0]?.arguments, [
      {
        where: {
          source: 'import',
          provider: 'karabas',
          status: 'published',
          externalId: { notIn: ['lama-15', 'sting-2'] },
          startsAt: { gt: new Date(range.from), lte: new Date(range.to) },
        },
        data: { status: 'cancelled' },
      },
    ]);
  });
});

describe('PrismaImportedEventsRepository.finishRun', () => {
  test('records what a succeeded run saw', async () => {
    const { repository, prisma } = makeRepository();

    await repository.finishRun(RUN_ID, 'succeeded', { complete: true, seen: 640, parts: { '/concerts/': 190 } });

    const [{ where, data }] = prisma.importRun.update.mock.calls[0]?.arguments as unknown as [
      { where: unknown; data: Record<string, unknown> },
    ];
    assert.deepEqual(where, { id: RUN_ID });
    assert.deepEqual(
      { status: data.status, complete: data.complete, seen: data.seen, parts: data.parts },
      { status: 'succeeded', complete: true, seen: 640, parts: { '/concerts/': 190 } },
    );
    assert.ok(data.finishedAt instanceof Date);
  });

  test('records only the status of a failed run', async () => {
    const { repository, prisma } = makeRepository();

    await repository.finishRun(RUN_ID, 'failed');

    const [{ data }] = prisma.importRun.update.mock.calls[0]?.arguments as unknown as [{ data: object }];
    assert.deepEqual(Object.keys(data).sort(), ['finishedAt', 'status']);
  });
});

describe('PrismaImportedEventsRepository.lastCompleteRun', () => {
  test('reads the provider’s last succeeded complete run, keeping only the counts of its parts', async () => {
    const { repository, prisma } = makeRepository();
    prisma.importRun.findFirst.mock.mockImplementation(() =>
      Promise.resolve({ seen: 640, parts: { '/concerts/': 190, '/odd/': 'many' } }),
    );

    const last = await repository.lastCompleteRun('karabas');

    assert.deepEqual(last, { seen: 640, parts: { '/concerts/': 190 } });
    assert.deepEqual(prisma.importRun.findFirst.mock.calls[0]?.arguments, [
      {
        where: { provider: 'karabas', status: 'succeeded', complete: true },
        orderBy: { startedAt: 'desc' },
        select: { seen: true, parts: true },
      },
    ]);
  });

  test('is undefined for a provider without a complete run', async () => {
    const { repository } = makeRepository();

    assert.equal(await repository.lastCompleteRun('karabas'), undefined);
  });
});

describe('PrismaImportedEventsRepository.saveSkipped', () => {
  const rawOf = (prisma: ReturnType<typeof makeRepository>['prisma']) =>
    (prisma.skippedRecord.create.mock.calls[0]?.arguments as unknown as [{ data: { raw: unknown } }])[0].data.raw;

  test('keeps the record as JSON, without what JSON cannot hold', async () => {
    const { repository, prisma } = makeRepository();

    await repository.saveSkipped(
      RUN_ID,
      { id: 'cu-1005', title: '', venue: { name: 'Club' }, at: undefined },
      'Invalid',
    );

    assert.deepEqual(rawOf(prisma), { id: 'cu-1005', title: '', venue: { name: 'Club' } });
  });

  test('keeps a record that is not there as JSON null', async () => {
    const { repository, prisma } = makeRepository();

    await repository.saveSkipped(RUN_ID, undefined, 'Invalid record: record');

    assert.equal(rawOf(prisma), Prisma.JsonNull);
  });
});

describe('ImportPrismaService', () => {
  test('does not start without IMPORT_DATABASE_URL, whatever else is set', () => {
    const saved = process.env.IMPORT_DATABASE_URL;
    delete process.env.IMPORT_DATABASE_URL;
    try {
      assert.throws(() => new ImportPrismaService(), /IMPORT_DATABASE_URL is not set/);
    } finally {
      if (saved !== undefined) {
        process.env.IMPORT_DATABASE_URL = saved;
      }
    }
  });
});
