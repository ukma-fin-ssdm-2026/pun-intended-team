// Written with the help of Claude
import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { EventImportService } from '../core/import/services/event-import.service.ts';
import { ImportAppModule } from './app.module.ts';

// Local settings; variables already set in the environment win. The import reads only IMPORT_DATABASE_URL.
if (existsSync('.env')) {
  process.loadEnvFile();
}

// One import run, then exit; a scheduler (pg-boss `import.run`, HLD I3) will start it later.
const app = await NestFactory.createApplicationContext(ImportAppModule);
try {
  const report = await app.get(EventImportService).run();
  new Logger('Import').log(JSON.stringify(report, null, 2));
} finally {
  await app.close();
}
