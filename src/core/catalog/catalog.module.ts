// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service.ts';
import { EventsService } from './services/events.service.ts';

@Module({
  providers: [EventsService, CategoriesService],
  exports: [EventsService, CategoriesService],
})
export class CatalogModule {}
