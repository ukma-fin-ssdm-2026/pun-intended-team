// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.ts';
import { EventImportService } from './services/event-import.service.ts';

/**
 * The import (CMP-03). Only the import's own start command loads it, never the API (HLD §4.3): it reads the
 * categories through the catalog's service and writes through its own repository.
 */
@Module({
  imports: [CatalogModule],
  providers: [EventImportService],
  exports: [EventImportService],
})
export class ImportModule {}
