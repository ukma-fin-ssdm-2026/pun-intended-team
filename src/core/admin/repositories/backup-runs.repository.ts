// Written with the help of Claude
import type { BackupRun } from '../types/backup.ts';

/** The nightly backups that deploy/backup-db.sh records; read only. */
export abstract class BackupRunsRepository {
  /** Newest first. */
  abstract recent(limit: number): Promise<BackupRun[]>;
  abstract lastSucceededAt(): Promise<string | undefined>;
}
