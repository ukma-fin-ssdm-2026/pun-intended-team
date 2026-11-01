// Written with the help of Claude
import { Module } from '@nestjs/common';
import { EventImportService } from './services/event-import.service.ts';

/**
 * The import (CMP-03). Only the import's own start command loads it, never the API (HLD §4.3). It depends on no
 * other module: it reads the categories and writes through its own repository.
 */
@Module({
  providers: [EventImportService],
  exports: [EventImportService],
})
export class ImportModule {}
