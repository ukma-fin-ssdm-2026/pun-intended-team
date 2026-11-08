// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { BackupRunsRepository } from '../repositories/backup-runs.repository.ts';
import type { BackupHistory, BackupRun, BackupStatus } from '../types/backup.ts';

// A night with its retries and a margin.
export const BACKUP_MAX_AGE_MS = 26 * 60 * 60 * 1000;
export const BACKUP_HISTORY_NIGHTS = 30;

/** Whether the nightly database backups are up to date (REL-06). */
@Injectable()
export class BackupsService {
  constructor(private readonly backupRunsRepository: BackupRunsRepository) {}

  /** Null where no nightly backup has run, e.g. in development. */
  async status(now = new Date()): Promise<BackupStatus | null> {
    const [latest] = await this.backupRunsRepository.recent(1);
    return this.statusOf(latest, now);
  }

  /** The status and the last nights, newest first. */
  async history(now = new Date()): Promise<BackupHistory> {
    const items = await this.backupRunsRepository.recent(BACKUP_HISTORY_NIGHTS);
    return { status: await this.statusOf(items[0], now), items };
  }

  private async statusOf(latest: BackupRun | undefined, now: Date): Promise<BackupStatus | null> {
    if (!latest) {
      return null;
    }
    const lastSucceededAt = latest.succeeded ? latest.finishedAt : await this.backupRunsRepository.lastSucceededAt();
    const overdue = !latest.succeeded || now.getTime() - Date.parse(latest.finishedAt) > BACKUP_MAX_AGE_MS;
    return { lastSucceededAt: lastSucceededAt ?? null, overdue };
  }
}
