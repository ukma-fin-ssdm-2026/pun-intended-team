// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { CategoriesRepository } from '../core/catalog/repositories/categories.repository.ts';
import { EventsRepository } from '../core/catalog/repositories/events.repository.ts';
import { OrganizationsRepository } from '../core/catalog/repositories/organizations.repository.ts';
import { VenuesRepository } from '../core/catalog/repositories/venues.repository.ts';
import { AccountsRepository } from '../core/identity/repositories/accounts.repository.ts';
import { InterestsRepository } from '../core/profiles/repositories/interests.repository.ts';
import { ProfilesRepository } from '../core/profiles/repositories/profiles.repository.ts';
import { AccessTokens } from '../core/identity/adapters/access-tokens.ts';
import { CodeHasher } from '../core/identity/adapters/code-hasher.ts';
import { GoogleIdTokens } from '../core/identity/adapters/google-id-tokens.ts';
import { PasswordHasher } from '../core/identity/adapters/password-hasher.ts';
import { SessionsRepository } from '../core/identity/repositories/sessions.repository.ts';
import { VerificationCodesRepository } from '../core/identity/repositories/verification-codes.repository.ts';
import { ListingsRepository } from '../core/listings/repositories/listings.repository.ts';
import { MessagingProvider } from '../core/notifications/adapters/messaging-provider.ts';
import { Argon2PasswordHasher } from './auth/argon2-password-hasher.ts';
import { loadGoogleSettings } from './auth/google-settings.ts';
import { HmacCodeHasher } from './auth/hmac-code-hasher.ts';
import { JoseAccessTokens } from './auth/jose-access-tokens.ts';
import { JoseGoogleIdTokens } from './auth/jose-google-id-tokens.ts';
import { loadCodeHmacKey, loadContactHmacKey, loadDataEncryptionKey, loadSigningKeys } from './auth/key-files.ts';
import { ConsoleMessagingProvider } from './messaging/console-messaging-provider.ts';
import { FallbackMessagingProvider } from './messaging/fallback-messaging-provider.ts';
import { loadMessagingSettings } from './messaging/messaging-settings.ts';
import { TelegramGatewaySender } from './messaging/telegram-gateway-sender.ts';
import { TurboSmsSender } from './messaging/turbosms-sender.ts';
import { PersonalDataCipher } from './prisma/personal-data-cipher.ts';
import { PrismaAccountsRepository } from './prisma/prisma-accounts.repository.ts';
import { PrismaCategoriesRepository } from './prisma/prisma-categories.repository.ts';
import { PrismaSessionsRepository } from './prisma/prisma-sessions.repository.ts';
import { PrismaVerificationCodesRepository } from './prisma/prisma-verification-codes.repository.ts';
import { PrismaService } from './prisma/prisma.service.ts';
import { StubEventsRepository } from './stubs/events.repository.ts';
import { StubInterestsRepository } from './stubs/interests.repository.ts';
import { StubListingsRepository } from './stubs/listings.repository.ts';
import { StubOrganizationsRepository } from './stubs/organizations.repository.ts';
import { StubProfilesRepository } from './stubs/profiles.repository.ts';
import { StubVenuesRepository } from './stubs/venues.repository.ts';

const repositories = [
  { provide: EventsRepository, useClass: StubEventsRepository },
  { provide: CategoriesRepository, useClass: PrismaCategoriesRepository },
  { provide: VenuesRepository, useClass: StubVenuesRepository },
  { provide: OrganizationsRepository, useClass: StubOrganizationsRepository },
  { provide: AccountsRepository, useClass: PrismaAccountsRepository },
  { provide: VerificationCodesRepository, useClass: PrismaVerificationCodesRepository },
  { provide: SessionsRepository, useClass: PrismaSessionsRepository },
  { provide: ProfilesRepository, useClass: StubProfilesRepository },
  { provide: ListingsRepository, useClass: StubListingsRepository },
  { provide: InterestsRepository, useClass: StubInterestsRepository },
];

const adapters = [
  { provide: MessagingProvider, useFactory: messagingProvider },
  { provide: PasswordHasher, useClass: Argon2PasswordHasher },
  { provide: CodeHasher, useFactory: () => new HmacCodeHasher(loadCodeHmacKey()) },
  { provide: AccessTokens, useFactory: () => new JoseAccessTokens(loadSigningKeys()) },
  {
    provide: GoogleIdTokens,
    useFactory: () => {
      const { clientIds, jwksUrl } = loadGoogleSettings();
      return new JoseGoogleIdTokens(clientIds, createRemoteJWKSet(jwksUrl));
    },
  },
];

const providers = [...repositories, ...adapters];

function messagingProvider(): MessagingProvider {
  const settings = loadMessagingSettings();
  if (settings.provider === 'console') {
    return new ConsoleMessagingProvider();
  }
  const { telegramToken, turboSms } = settings;
  return new FallbackMessagingProvider([
    new TelegramGatewaySender(telegramToken),
    ...(turboSms ? [new TurboSmsSender(turboSms.token, turboSms.sender)] : []),
  ]);
}

export function personalDataCipher(): PersonalDataCipher {
  return new PersonalDataCipher(loadDataEncryptionKey(), loadContactHmacKey());
}

@Global()
@Module({
  providers: [PrismaService, { provide: PersonalDataCipher, useFactory: personalDataCipher }, ...providers],
  exports: providers.map(({ provide }) => provide),
})
export class InfraModule {}
