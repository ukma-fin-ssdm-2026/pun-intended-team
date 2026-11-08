// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service.ts';
import { EventsService } from './services/events.service.ts';
import { OrganizationsService } from './services/organizations.service.ts';

@Module({
  providers: [EventsService, CategoriesService, OrganizationsService],
  exports: [EventsService, CategoriesService, OrganizationsService],
})
export class CatalogModule {}
