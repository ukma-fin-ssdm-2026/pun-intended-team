// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service.ts';
import { EventImportService } from './services/event-import.service.ts';
import { EventsService } from './services/events.service.ts';

@Module({
  providers: [EventsService, CategoriesService, EventImportService],
  exports: [EventsService, CategoriesService, EventImportService],
})
export class CatalogModule {}
