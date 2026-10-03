// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { CategoriesRepository } from '../core/catalog/repositories/categories.repository.js';
import { EventsRepository } from '../core/catalog/repositories/events.repository.js';
import { OrganizationsRepository } from '../core/catalog/repositories/organizations.repository.js';
import { VenuesRepository } from '../core/catalog/repositories/venues.repository.js';
import { SessionsRepository } from '../core/identity/repositories/sessions.repository.js';
import { StubCategoriesRepository } from './stubs/categories.repository.js';
import { StubEventsRepository } from './stubs/events.repository.js';
import { StubOrganizationsRepository } from './stubs/organizations.repository.js';
import { StubSessionsRepository } from './stubs/sessions.repository.js';
import { StubVenuesRepository } from './stubs/venues.repository.js';

const repositories = [
  { provide: EventsRepository, useClass: StubEventsRepository },
  { provide: CategoriesRepository, useClass: StubCategoriesRepository },
  { provide: VenuesRepository, useClass: StubVenuesRepository },
  { provide: OrganizationsRepository, useClass: StubOrganizationsRepository },
  { provide: SessionsRepository, useClass: StubSessionsRepository },
];

@Global()
@Module({
  providers: repositories,
  exports: repositories.map(({ provide }) => provide),
})
export class InfraModule {}
