// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ImportRunsRepository } from '../repositories/import-runs.repository.ts';
import type { ProviderFreshness } from '../types/import-freshness.ts';

/**
 * FR-014: while a provider's latest import run has failed, the catalog keeps serving the events of its last succeeded
 * run (ADR-006, decisions 3 and 10), and the client shows when that run was.
 */
@Injectable()
export class ImportFreshnessService {
  constructor(private readonly importRunsRepository: ImportRunsRepository) {}

  /** Every provider's freshness, by provider id. */
  async list(): Promise<ProviderFreshness[]> {
    const providers = await this.importRunsRepository.freshness();
    return providers.toSorted((a, b) => a.provider.localeCompare(b.provider));
  }
}
