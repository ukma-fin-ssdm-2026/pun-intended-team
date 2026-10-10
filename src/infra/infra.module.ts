// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { CategoriesRepository } from '../core/catalog/repositories/categories.repository.ts';
import { EventsRepository } from '../core/catalog/repositories/events.repository.ts';
import { OrganizationsRepository } from '../core/catalog/repositories/organizations.repository.ts';
import { VenuesRepository } from '../core/catalog/repositories/venues.repository.ts';
import { AccountsRepository } from '../core/identity/repositories/accounts.repository.ts';
import { SessionsRepository } from '../core/identity/repositories/sessions.repository.ts';
import { ListingsRepository } from '../core/listings/repositories/listings.repository.ts';
import { InterestsRepository } from '../core/profiles/repositories/interests.repository.ts';
import { ProfilesRepository } from '../core/profiles/repositories/profiles.repository.ts';
import { StubAccountsRepository } from './stubs/accounts.repository.ts';
import { StubCategoriesRepository } from './stubs/categories.repository.ts';
import { StubEventsRepository } from './stubs/events.repository.ts';
import { StubInterestsRepository } from './stubs/interests.repository.ts';
import { StubListingsRepository } from './stubs/listings.repository.ts';
import { StubOrganizationsRepository } from './stubs/organizations.repository.ts';
import { StubProfilesRepository } from './stubs/profiles.repository.ts';
import { StubSessionsRepository } from './stubs/sessions.repository.ts';
import { StubVenuesRepository } from './stubs/venues.repository.ts';

const repositories = [
  { provide: EventsRepository, useClass: StubEventsRepository },
  { provide: CategoriesRepository, useClass: StubCategoriesRepository },
  { provide: VenuesRepository, useClass: StubVenuesRepository },
  { provide: OrganizationsRepository, useClass: StubOrganizationsRepository },
  { provide: SessionsRepository, useClass: StubSessionsRepository },
  { provide: ProfilesRepository, useClass: StubProfilesRepository },
  { provide: ListingsRepository, useClass: StubListingsRepository },
  { provide: InterestsRepository, useClass: StubInterestsRepository },
  { provide: AccountsRepository, useClass: StubAccountsRepository },
];

@Global()
@Module({
  providers: repositories,
  exports: repositories.map(({ provide }) => provide),
})
export class InfraModule {}
