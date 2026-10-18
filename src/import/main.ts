// Written with the help of Claude
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import '../api/common/config.ts';
import { EventImportService } from '../core/catalog/services/event-import.service.ts';
import { ImportModule } from './import.module.ts';

// One import run, then exit; a scheduler (pg-boss `import.run`, HLD I3) will start it later.
const app = await NestFactory.createApplicationContext(ImportModule);
const report = await app.get(EventImportService).run();
new Logger('Import').log(JSON.stringify(report, null, 2));
await app.close();
