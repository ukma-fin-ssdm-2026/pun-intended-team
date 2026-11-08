// Written with the help of Claude
import { z } from 'zod';
import { BackupStatus } from './backups.ts';

const PlatformStatsFields = z.object({
  users: z.number().int().describe('Active accounts: registered and not banned'),
  events: z.number().int().describe('Published events that have not ended yet'),
  matches: z.number().int().describe('Matches proposed so far'),
  openReports: z.number().int().describe('Open report cases'),
  backup: BackupStatus.nullable().describe('Nightly database backups; null where none has run, e.g. in development'),
});

export const platformStatsExample: PlatformStats = {
  users: 128,
  events: 42,
  matches: 0,
  openReports: 3,
  backup: { lastSucceededAt: '2026-11-07T01:00:42.000Z', overdue: false },
};

export const PlatformStats = PlatformStatsFields.meta({ id: 'PlatformStats', example: platformStatsExample });

export type PlatformStats = z.infer<typeof PlatformStatsFields>;
