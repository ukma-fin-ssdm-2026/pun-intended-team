// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { ImportRunsRepository } from '../../dist/core/catalog/repositories/import-runs.repository.js';
import { ImportFreshnessService } from '../../dist/core/catalog/services/import-freshness.service.js';
import type { ProviderFreshness } from '../../dist/core/catalog/types/import-freshness.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { PrismaImportRunsRepository } from '../../dist/infra/prisma/prisma-import-runs.repository.js';

// FR-014, REL-003
describe('ImportFreshnessService.list', () => {
  test('lists every provider by id, with when it was last updated and whether its latest run failed', async () => {
    const providers: ProviderFreshness[] = [
      { provider: 'karabas', lastSucceededAt: '2026-11-10T02:01:12.000Z', latestRunFailed: true },
      { provider: 'artwizard', lastSucceededAt: '2026-11-11T02:00:31.000Z', latestRunFailed: false },
    ];
    const repository = { freshness: mock.fn(() => Promise.resolve(providers)) };
    const service = new ImportFreshnessService(repository as unknown as ImportRunsRepository);

    assert.deepEqual(await service.list(), [providers[1], providers[0]]);
  });
});

describe('PrismaImportRunsRepository.freshness', () => {
  type Run = { provider: string; status: string; finishedAt: Date | null };

  /** Answers the two queries as the database would: the latest run per provider among the asked statuses. */
  function makeRepository(runs: (Run & { startedAt: Date })[]) {
    const findMany = mock.fn(({ where }: { where: { status: { in: string[] } } }) => {
      const latest = new Map<string, Run>();
      for (const run of runs.toSorted((a, b) => b.startedAt.getTime() - a.startedAt.getTime())) {
        if (where.status.in.includes(run.status) && !latest.has(run.provider)) {
          latest.set(run.provider, { provider: run.provider, status: run.status, finishedAt: run.finishedAt });
        }
      }
      return Promise.resolve([...latest.values()]);
    });
    const prisma = { importRun: { findMany } };
    return { repository: new PrismaImportRunsRepository(prisma as unknown as PrismaService), findMany };
  }

  const at = (iso: string) => new Date(iso);

  test('gives a provider whose latest run failed the finish of its last succeeded one', async () => {
    const { repository } = makeRepository([
      {
        provider: 'karabas',
        status: 'succeeded',
        startedAt: at('2026-11-09T02:00:00Z'),
        finishedAt: at('2026-11-09T02:01:00Z'),
      },
      {
        provider: 'karabas',
        status: 'succeeded',
        startedAt: at('2026-11-10T02:00:00Z'),
        finishedAt: at('2026-11-10T02:01:12Z'),
      },
      {
        provider: 'karabas',
        status: 'failed',
        startedAt: at('2026-11-11T02:00:00Z'),
        finishedAt: at('2026-11-11T02:00:05Z'),
      },
    ]);

    assert.deepEqual(await repository.freshness(), [
      { provider: 'karabas', lastSucceededAt: '2026-11-10T02:01:12.000Z', latestRunFailed: true },
    ]);
  });

  test('judges a provider by its last ended run while a run is still going', async () => {
    const { repository, findMany } = makeRepository([
      {
        provider: 'artwizard',
        status: 'succeeded',
        startedAt: at('2026-11-10T02:00:00Z'),
        finishedAt: at('2026-11-10T02:00:31Z'),
      },
      { provider: 'artwizard', status: 'running', startedAt: at('2026-11-11T02:00:00Z'), finishedAt: null },
    ]);

    assert.deepEqual(await repository.freshness(), [
      { provider: 'artwizard', lastSucceededAt: '2026-11-10T02:00:31.000Z', latestRunFailed: false },
    ]);
    assert.deepEqual(findMany.mock.calls[0]?.arguments[0], {
      where: { status: { in: ['succeeded', 'failed'] } },
      distinct: ['provider'],
      orderBy: [{ provider: 'asc' }, { startedAt: 'desc' }],
      select: { provider: true, status: true, finishedAt: true },
    });
  });

  test('gives no time for a provider that never succeeded', async () => {
    const { repository } = makeRepository([
      { provider: 'artwizard', status: 'failed', startedAt: at('2026-11-11T02:00:00Z'), finishedAt: null },
    ]);

    assert.deepEqual(await repository.freshness(), [
      { provider: 'artwizard', lastSucceededAt: null, latestRunFailed: true },
    ]);
  });

  test('lists nothing before the first run', async () => {
    assert.deepEqual(await makeRepository([]).repository.freshness(), []);
  });
});
