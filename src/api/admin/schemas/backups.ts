// Written with the help of Claude
import { z } from 'zod';
import { backupFailureReasons } from '../../../core/admin/types/backup.ts';
import { DateTime } from '../../common/schemas/common.ts';

const BackupStatusFields = z.object({
  lastSucceededAt: DateTime.nullable().describe('When the last nightly backup succeeded; null if none has'),
  overdue: z.boolean().describe('The last nightly backup failed, or it is more than 26 hours old'),
});

export const BackupStatus = BackupStatusFields.meta({ id: 'BackupStatus' });

const BackupRunFields = z.object({
  finishedAt: DateTime.describe('When the night ended: the copy was kept, or the last attempt failed'),
  succeeded: z.boolean(),
  attempts: z.number().int().describe('Attempts that night, at most 3'),
  durationSeconds: z.number().int().describe('How long the last attempt took'),
  sizeBytes: z.number().int().nullable().describe('Size of the copy; null when the night failed'),
  reason: z
    .enum(backupFailureReasons)
    .nullable()
    .describe(
      'Why the night failed; null when it succeeded. `unreachable`: the database did not answer. `auth_failed`: it ' +
        'refused the sign-in. `timeout`: the copy took more than 15 minutes. `locked`: tables stayed locked, e.g. by a ' +
        'migration. `unreadable`: the copy could not be read back. `failed`: anything else. The details are only in ' +
        'the server log',
    ),
});

export const BackupRun = BackupRunFields.meta({ id: 'BackupRun' });

const BackupHistoryFields = z.object({
  status: BackupStatus.nullable().describe('Null where no nightly backup has run, e.g. in development'),
  items: z.array(BackupRun).describe('The last 30 nights, newest first'),
});

export const backupHistoryExample: BackupHistory = {
  status: { lastSucceededAt: '2026-11-06T01:00:12.000Z', overdue: true },
  items: [
    {
      finishedAt: '2026-11-07T01:20:31.000Z',
      succeeded: false,
      attempts: 3,
      durationSeconds: 0,
      sizeBytes: null,
      reason: 'unreachable',
    },
    {
      finishedAt: '2026-11-06T01:00:12.000Z',
      succeeded: true,
      attempts: 1,
      durationSeconds: 12,
      sizeBytes: 4404019,
      reason: null,
    },
  ],
};

export const BackupHistory = BackupHistoryFields.meta({ id: 'BackupHistory', example: backupHistoryExample });

export type BackupHistory = z.infer<typeof BackupHistoryFields>;
