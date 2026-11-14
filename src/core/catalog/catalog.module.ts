// Written with the help of Claude
import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service.ts';
import { EventSessionsService } from './services/event-sessions.service.ts';
import { EventsService } from './services/events.service.ts';
import { ImportFreshnessService } from './services/import-freshness.service.ts';
import { OrganizationsService } from './services/organizations.service.ts';

@Module({
  providers: [EventsService, EventSessionsService, CategoriesService, OrganizationsService, ImportFreshnessService],
  exports: [EventsService, EventSessionsService, CategoriesService, OrganizationsService, ImportFreshnessService],
})
export class CatalogModule {}
