// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { BackupRunsRepository } from '../../core/admin/repositories/backup-runs.repository.ts';
import type { BackupFailureReason, BackupRun } from '../../core/admin/types/backup.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaBackupRunsRepository implements BackupRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recent(limit: number): Promise<BackupRun[]> {
    const runs = await this.prisma.backupRun.findMany({ orderBy: { finishedAt: 'desc' }, take: limit });
    return runs.map((run) => ({
      finishedAt: run.finishedAt.toISOString(),
      succeeded: run.succeeded,
      attempts: run.attempts,
      durationSeconds: run.durationSeconds,
      sizeBytes: run.sizeBytes === null ? null : Number(run.sizeBytes),
      // The CHECK constraint of backup_runs allows only these codes.
      reason: run.reason as BackupFailureReason | null,
    }));
  }

  async lastSucceededAt(): Promise<string | undefined> {
    const run = await this.prisma.backupRun.findFirst({
      where: { succeeded: true },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });
    return run?.finishedAt.toISOString();
  }
}
