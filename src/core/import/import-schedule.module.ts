// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ImportModule } from './import.module.ts';
import { ImportScheduleService } from './services/import-schedule.service.ts';

/**
 * The import's schedule (HLD I3): the `import.run` handler and a daily cron per provider. Only the long-running import
 * process loads it, with a job queue bound; a one-off run (`--once`) does not.
 */
@Module({
  imports: [ImportModule],
  providers: [ImportScheduleService],
})
export class ImportScheduleModule {}
