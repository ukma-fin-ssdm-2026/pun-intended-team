// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service.ts';
import { EventSessionsService } from './services/event-sessions.service.ts';
import { EventsService } from './services/events.service.ts';

@Module({
  providers: [EventsService, EventSessionsService, CategoriesService],
  exports: [EventsService, EventSessionsService, CategoriesService],
})
export class CatalogModule {}
