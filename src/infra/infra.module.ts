// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { CategoriesRepository } from '../core/catalog/repositories/categories.repository.ts';
import { EventsRepository } from '../core/catalog/repositories/events.repository.ts';
import { OrganizationsRepository } from '../core/catalog/repositories/organizations.repository.ts';
import { VenuesRepository } from '../core/catalog/repositories/venues.repository.ts';
import { AccessTokens } from '../core/identity/adapters/access-tokens.ts';
import { CodeHasher } from '../core/identity/adapters/code-hasher.ts';
import { PasswordHasher } from '../core/identity/adapters/password-hasher.ts';
import { AccountsRepository } from '../core/identity/repositories/accounts.repository.ts';
import { SessionsRepository } from '../core/identity/repositories/sessions.repository.ts';
import { VerificationCodesRepository } from '../core/identity/repositories/verification-codes.repository.ts';
import { ListingsRepository } from '../core/listings/repositories/listings.repository.ts';
import { MessagingProvider } from '../core/notifications/adapters/messaging-provider.ts';
import { ProfilesRepository } from '../core/profiles/repositories/profiles.repository.ts';
import { Argon2PasswordHasher } from './auth/argon2-password-hasher.ts';
import { HmacCodeHasher } from './auth/hmac-code-hasher.ts';
import { JoseAccessTokens } from './auth/jose-access-tokens.ts';
import { loadCodeHmacKey, loadSigningKeys } from './auth/key-files.ts';
import { ConsoleMessagingProvider } from './messaging/console-messaging-provider.ts';
import { StubAccountsRepository } from './stubs/accounts.repository.ts';
import { StubCategoriesRepository } from './stubs/categories.repository.ts';
import { StubEventsRepository } from './stubs/events.repository.ts';
import { StubListingsRepository } from './stubs/listings.repository.ts';
import { StubOrganizationsRepository } from './stubs/organizations.repository.ts';
import { StubProfilesRepository } from './stubs/profiles.repository.ts';
import { StubSessionsRepository } from './stubs/sessions.repository.ts';
import { StubVerificationCodesRepository } from './stubs/verification-codes.repository.ts';
import { StubVenuesRepository } from './stubs/venues.repository.ts';

const repositories = [
  { provide: EventsRepository, useClass: StubEventsRepository },
  { provide: CategoriesRepository, useClass: StubCategoriesRepository },
  { provide: VenuesRepository, useClass: StubVenuesRepository },
  { provide: OrganizationsRepository, useClass: StubOrganizationsRepository },
  { provide: SessionsRepository, useClass: StubSessionsRepository },
  { provide: AccountsRepository, useClass: StubAccountsRepository },
  { provide: VerificationCodesRepository, useClass: StubVerificationCodesRepository },
  { provide: ProfilesRepository, useClass: StubProfilesRepository },
  { provide: ListingsRepository, useClass: StubListingsRepository },
];

const adapters = [
  { provide: MessagingProvider, useClass: ConsoleMessagingProvider },
  { provide: PasswordHasher, useClass: Argon2PasswordHasher },
  { provide: CodeHasher, useFactory: () => new HmacCodeHasher(loadCodeHmacKey()) },
  { provide: AccessTokens, useFactory: () => new JoseAccessTokens(loadSigningKeys()) },
];

const providers = [...repositories, ...adapters];

@Global()
@Module({
  providers,
  exports: providers.map(({ provide }) => provide),
})
export class InfraModule {}
