// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { Prisma } from '../../dist/infra/prisma/generated/client.js';
import { ImportPrismaService } from '../../dist/infra/prisma/import-prisma.service.js';
import { PrismaImportedEventsRepository } from '../../dist/infra/prisma/prisma-imported-events.repository.js';

const RUN_ID = 'f0000000-0000-4000-8000-0000000000aa';

function makeRepository() {
  const prisma = {
    event: { update: mock.fn(() => Promise.resolve({})) },
    skippedRecord: { create: mock.fn(() => Promise.resolve({ id: 'skipped' })) },
  };
  return { repository: new PrismaImportedEventsRepository(prisma as unknown as ImportPrismaService), prisma };
}

describe('PrismaImportedEventsRepository.updateEvent', () => {
  test('changes only an imported event, so an organization event with the same id is never touched', async () => {
    const { repository, prisma } = makeRepository();
    const fields = {
      title: 'Jazz evening',
      description: 'Live quartet.',
      categoryId: 'c0000000-0000-4000-8000-000000000001',
      venueId: 'b0000000-0000-4000-8000-000000000001',
      startsAt: '2026-10-22T16:00:00.000Z',
      endsAt: '2026-10-22T19:00:00.000Z',
    };

    await repository.updateEvent('e0000000-0000-4000-8000-000000000001', fields);

    assert.deepEqual(prisma.event.update.mock.calls[0]?.arguments, [
      {
        where: { id: 'e0000000-0000-4000-8000-000000000001', source: 'import' },
        data: { ...fields, startsAt: new Date(fields.startsAt), endsAt: new Date(fields.endsAt) },
      },
    ]);
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
