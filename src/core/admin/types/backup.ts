// Written with the help of Claude

/** Why a nightly backup failed, as deploy/backup-db.sh records it; the details stay in the server log. */
export const backupFailureReasons = [
  'unreachable',
  'auth_failed',
  'timeout',
  'locked',
  'unreadable',
  'failed',
] as const;

export type BackupFailureReason = (typeof backupFailureReasons)[number];

export interface BackupRun {
  finishedAt: string;
  succeeded: boolean;
  attempts: number;
  durationSeconds: number;
  sizeBytes: number | null;
  reason: BackupFailureReason | null;
}

export interface BackupStatus {
  lastSucceededAt: string | null;
  overdue: boolean;
}

export interface BackupHistory {
  status: BackupStatus | null;
  items: BackupRun[];
}
