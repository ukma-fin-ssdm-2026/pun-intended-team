// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ImportRunsRepository } from '../../core/catalog/repositories/import-runs.repository.ts';
import type { ProviderFreshness } from '../../core/catalog/types/import-freshness.ts';
import { PrismaService } from './prisma.service.ts';

/** Reads `import_runs` as `nearby_main`, which the import's role writes (HLD I4). */
@Injectable()
export class PrismaImportRunsRepository implements ImportRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async freshness(): Promise<ProviderFreshness[]> {
    // The latest ended run, and the latest succeeded one, of each provider.
    const latest = (status: string[]) =>
      this.prisma.importRun.findMany({
        where: { status: { in: status } },
        distinct: ['provider'],
        orderBy: [{ provider: 'asc' }, { startedAt: 'desc' }],
        select: { provider: true, status: true, finishedAt: true },
      });
    const [ended, succeeded] = await Promise.all([latest(['succeeded', 'failed']), latest(['succeeded'])]);
    const finishedAt = new Map(succeeded.map((run) => [run.provider, run.finishedAt]));
    return ended.map((run) => ({
      provider: run.provider,
      lastSucceededAt: finishedAt.get(run.provider)?.toISOString() ?? null,
      latestRunFailed: run.status === 'failed',
    }));
  }
}
