// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ImagesModule } from '../images/images.module.ts';
import { CategoriesService } from './services/categories.service.ts';
import { EventSessionsService } from './services/event-sessions.service.ts';
import { EventsService } from './services/events.service.ts';
import { ImportFreshnessService } from './services/import-freshness.service.ts';
import { OrganizationsService } from './services/organizations.service.ts';
import { VenuesService } from './services/venues.service.ts';

@Module({
  imports: [ImagesModule],
  providers: [
    EventsService,
    EventSessionsService,
    CategoriesService,
    OrganizationsService,
    ImportFreshnessService,
    VenuesService,
  ],
  exports: [
    EventsService,
    EventSessionsService,
    CategoriesService,
    OrganizationsService,
    ImportFreshnessService,
    VenuesService,
  ],
})
export class CatalogModule {}
