// Written with the help of Claude
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { JobQueue } from '../../jobs/adapters/job-queue.ts';
import { EVENT_PROVIDERS, EventProvider } from '../adapters/event-provider.ts';
import { EventImportService } from './event-import.service.ts';

/** The job that runs one provider's import (HLD I3). */
export const IMPORT_RUN_JOB = 'import.run';

/** Every provider's run, daily at 02:00 UTC, after the nightly backup at 01:00. */
export const IMPORT_CRON = '0 2 * * *';

/** A run takes minutes (ADR-006); one still going after an hour counts as failed. */
const IMPORT_TIMEOUT_SECONDS = 60 * 60;

export interface ImportRunPayload {
  providerId: string;
}

/**
 * Runs the import on a schedule: one `import.run` job per provider and day. A job is never retried, since a second
 * run on the same day would break ArtWizard's one update a day (ADR-006, decision 9); the next day's job runs again.
 * The run itself checks when the provider's last run started, so a repeated job, or one after a run by hand, starts
 * nothing.
 */
@Injectable()
export class ImportScheduleService implements OnModuleInit {
  private readonly logger = new Logger(ImportScheduleService.name);

  constructor(
    @Inject(EVENT_PROVIDERS) private readonly providers: EventProvider[],
    private readonly importService: EventImportService,
    private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register<ImportRunPayload>(IMPORT_RUN_JOB, ({ payload }) => this.handle(payload), {
      retryLimit: 0,
      timeoutSeconds: IMPORT_TIMEOUT_SECONDS,
    });
    for (const { id } of this.providers) {
      this.jobs.schedule(IMPORT_RUN_JOB, IMPORT_CRON, { providerId: id } satisfies ImportRunPayload, id);
    }
  }

  /** Throws when the run failed, so the job is failed too; a run that was not started is not a failure. */
  async handle({ providerId }: ImportRunPayload): Promise<void> {
    const summary = await this.importService.runProvider(providerId);
    if (!summary) {
      // E.g. the schedule of a provider that was unbound since (ADR-006, decision 9): nothing to do.
      this.logger.warn(`${IMPORT_RUN_JOB}: no provider ${JSON.stringify(providerId)}; the job does nothing`);
      return;
    }
    const [failed] = summary.failed;
    if (failed) {
      throw new Error(`${failed.provider}: the run failed: ${failed.error}`);
    }
  }
}
