// Written with the help of Claude
import type { ProviderImportStatus } from '../types/import-freshness.ts';

/**
 * The import's runs as the catalog reads them (HLD I4: the import writes `import_runs`, the main server reads it), for
 * the "last updated" notice (FR-014).
 */
export abstract class ImportRunsRepository {
  /** One entry per provider that has ever had a run; a run still going is left out, so it is judged by the one before. */
  abstract freshness(): Promise<ProviderImportStatus[]>;
}
