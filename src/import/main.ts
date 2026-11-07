// Written with the help of Claude
import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EventImportService } from '../core/import/services/event-import.service.ts';
import { ImportAppModule } from './app.module.ts';

// Local settings; variables already set in the environment win. The import reads IMPORT_DATABASE_URL, and the
// IMPORT_* and *_BASE_URL settings of .env.example.
if (existsSync('.env')) {
  process.loadEnvFile();
}

// One import run, then exit; a scheduler (pg-boss `import.run`, HLD I3) will start it later.
const app = await NestFactory.createApplicationContext(ImportAppModule);
try {
  const summary = await app.get(EventImportService).run();
  new Logger('Import').log(JSON.stringify(summary, null, 2));
  // A provider that failed fails the run, so a scheduler sees it; the other providers' events are saved.
  if (summary.failed.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await app.close();
}
