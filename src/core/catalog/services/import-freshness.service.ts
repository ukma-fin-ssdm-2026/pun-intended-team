// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ImportRunsRepository } from '../repositories/import-runs.repository.ts';

/**
 * FR-014: while a provider's latest import run has failed, the catalog keeps serving the events of its last succeeded
 * run (ADR-006, decisions 3 and 10), and the client shows when that run was.
 */
@Injectable()
export class ImportFreshnessService {
  constructor(private readonly importRunsRepository: ImportRunsRepository) {}

  /**
   * The time the imported events are from, for the "last updated" notice: when the last succeeded run finished of a
   * provider whose latest ended run failed, the oldest such time if several failed. Null while every provider's
   * latest run succeeded, so the events are current, and for a failed provider that never succeeded, which has no
   * events and no time to show. The whole rule of the notice is here; providers stay inside core.
   */
  async lastUpdatedAt(): Promise<string | null> {
    const providers = await this.importRunsRepository.freshness();
    const times = providers.flatMap(({ latestRunFailed, lastSucceededAt }) =>
      latestRunFailed && lastSucceededAt ? [lastSucceededAt] : [],
    );
    return times.reduce<string | null>(
      (oldest, time) => (oldest === null || Date.parse(time) < Date.parse(oldest) ? time : oldest),
      null,
    );
  }
}
