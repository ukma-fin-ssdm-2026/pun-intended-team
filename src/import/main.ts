// Written with the help of Claude
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EventImportService } from '../core/import/services/event-import.service.ts';
import { IMPORT_CRON, IMPORT_RUN_JOB } from '../core/import/services/import-schedule.service.ts';
import { ImportAppModule } from './app.module.ts';

// Local settings; variables already set in the environment win. The import reads IMPORT_DATABASE_URL, and the
// IMPORT_* and *_BASE_URL settings of .env.example.
if (existsSync('.env')) {
  process.loadEnvFile();
}

const logger = new Logger('Import');

// Without flags the process runs until it is stopped and imports on the schedule. `--once` runs every provider once
// and exits; `--force` (with `--once`, never in production) starts a run even when the provider's last one started
// within its minimum gap (ADR-006, decision 9).
const { values: flags } = parseArgs({ options: { once: { type: 'boolean' }, force: { type: 'boolean' } } });
if (flags.force && (!flags.once || process.env.NODE_ENV === 'production')) {
  logger.error('--force is for a local run only: use it with --once, and not with NODE_ENV=production');
  process.exit(2);
}

if (flags.once) {
  const app = await NestFactory.createApplicationContext(ImportAppModule.once());
  try {
    const summary = await app.get(EventImportService).run({ force: flags.force });
    logger.log(JSON.stringify(summary, null, 2));
    // A provider that failed fails the run; the other providers' events are saved. One not started is no failure.
    if (summary.failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
} else {
  const app = await NestFactory.createApplicationContext(ImportAppModule.worker());
  // SIGTERM (docker stop) and SIGINT close the app, and the job queue lets a running import finish first. Exits
  // normally on SIGTERM, as the API does, so coverage is written.
  process.once('SIGTERM', () => void app.close().then(() => process.exit(0)));
  app.enableShutdownHooks();
  logger.log(`Waiting for ${IMPORT_RUN_JOB} jobs; every provider runs on "${IMPORT_CRON}" (UTC)`);
}
