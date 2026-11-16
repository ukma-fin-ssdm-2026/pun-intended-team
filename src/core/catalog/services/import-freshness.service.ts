// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { HOUR_MS } from '../../common/durations.ts';
import { ImportRunsRepository } from '../repositories/import-runs.repository.ts';

// One daily run and some slack. A provider whose last succeeded run is older has stopped importing, e.g. the import
// container is down, even if no run has failed.
export const IMPORT_MAX_AGE_MS = 30 * HOUR_MS;

/**
 * FR-014: while a provider's latest import run has failed, or no run has succeeded for IMPORT_MAX_AGE_MS, the catalog
 * keeps serving the events of its last succeeded run (ADR-006, decisions 3 and 10), and the client shows when that run
 * was.
 */
@Injectable()
export class ImportFreshnessService {
  constructor(private readonly importRunsRepository: ImportRunsRepository) {}

  /**
   * The time the imported events are from, for the "last updated" notice: when the last succeeded run finished of a
   * provider whose latest ended run failed or whose last succeeded run is older than IMPORT_MAX_AGE_MS, the oldest
   * such time if there are several. Null while every provider's latest run succeeded recently, so the events are
   * current, and for a failed provider that never succeeded, which has no events and no time to show. The whole rule
   * of the notice is here; providers stay inside core.
   */
  async lastUpdatedAt(now = new Date()): Promise<string | null> {
    const providers = await this.importRunsRepository.freshness();
    const tooOld = (time: string) => now.getTime() - Date.parse(time) > IMPORT_MAX_AGE_MS;
    const times = providers.flatMap(({ latestRunFailed, lastSucceededAt }) =>
      lastSucceededAt && (latestRunFailed || tooOld(lastSucceededAt)) ? [lastSucceededAt] : [],
    );
    return times.reduce<string | null>(
      (oldest, time) => (oldest === null || Date.parse(time) < Date.parse(oldest) ? time : oldest),
      null,
    );
  }
}
