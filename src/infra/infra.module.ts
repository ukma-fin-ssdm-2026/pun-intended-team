// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { BackupRunsRepository } from '../core/admin/repositories/backup-runs.repository.ts';
import { TransactionRunner } from '../core/common/transaction-runner.ts';
import { CategoriesRepository } from '../core/catalog/repositories/categories.repository.ts';
import { EventSessionsRepository } from '../core/catalog/repositories/event-sessions.repository.ts';
import { EventsRepository } from '../core/catalog/repositories/events.repository.ts';
import { ImportRunsRepository } from '../core/catalog/repositories/import-runs.repository.ts';
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
import { ApplicationsRepository } from '../core/matching/repositories/applications.repository.ts';
import { MatchesRepository } from '../core/matching/repositories/matches.repository.ts';
import { AuditLogRepository } from '../core/moderation/repositories/audit-log.repository.ts';
import { ReportCasesRepository } from '../core/moderation/repositories/report-cases.repository.ts';
import { JobQueue } from '../core/jobs/adapters/job-queue.ts';
import { MessagingProvider } from '../core/notifications/adapters/messaging-provider.ts';
import { DatabaseProbe } from '../core/system/adapters/database-probe.ts';
import { Argon2PasswordHasher } from './auth/argon2-password-hasher.ts';
import { loadGoogleSettings } from './auth/google-settings.ts';
import { HmacCodeHasher } from './auth/hmac-code-hasher.ts';
import { JoseAccessTokens } from './auth/jose-access-tokens.ts';
import { JoseGoogleIdTokens } from './auth/jose-google-id-tokens.ts';
import { loadCodeHmacKey, loadContactHmacKey, loadDataEncryptionKey, loadSigningKeys } from './auth/key-files.ts';
import { PgBossJobQueue } from './jobs/pg-boss-job-queue.ts';
import { ConsoleMessagingProvider } from './messaging/console-messaging-provider.ts';
import { DisabledMessagingProvider } from './messaging/disabled-messaging-provider.ts';
import { FallbackMessagingProvider } from './messaging/fallback-messaging-provider.ts';
import { loadMessagingSettings } from './messaging/messaging-settings.ts';
import { TelegramGatewaySender } from './messaging/telegram-gateway-sender.ts';
import { TurboSmsSender } from './messaging/turbosms-sender.ts';
import { PersonalDataCipher } from './prisma/personal-data-cipher.ts';
import { PrismaAccountsRepository } from './prisma/prisma-accounts.repository.ts';
import { PrismaApplicationsRepository } from './prisma/prisma-applications.repository.ts';
import { PrismaAuditLogRepository } from './prisma/prisma-audit-log.repository.ts';
import { PrismaBackupRunsRepository } from './prisma/prisma-backup-runs.repository.ts';
import { PrismaCategoriesRepository } from './prisma/prisma-categories.repository.ts';
import { PrismaDatabaseProbe } from './prisma/prisma-database-probe.ts';
import { PrismaEventSessionsRepository } from './prisma/prisma-event-sessions.repository.ts';
import { PrismaEventsRepository } from './prisma/prisma-events.repository.ts';
import { PrismaImportRunsRepository } from './prisma/prisma-import-runs.repository.ts';
import { PrismaInterestsRepository } from './prisma/prisma-interests.repository.ts';
import { PrismaListingsRepository } from './prisma/prisma-listings.repository.ts';
import { PrismaMatchesRepository } from './prisma/prisma-matches.repository.ts';
import { PrismaOrganizationsRepository } from './prisma/prisma-organizations.repository.ts';
import { PrismaProfilesRepository } from './prisma/prisma-profiles.repository.ts';
import { PrismaReportCasesRepository } from './prisma/prisma-report-cases.repository.ts';
import { PrismaSessionsRepository } from './prisma/prisma-sessions.repository.ts';
import { PrismaVenuesRepository } from './prisma/prisma-venues.repository.ts';
import { PrismaVerificationCodesRepository } from './prisma/prisma-verification-codes.repository.ts';
import { PrismaService } from './prisma/prisma.service.ts';
import { PrismaTransactionRunner } from './prisma/prisma-transaction-runner.ts';

const repositories = [
  { provide: EventsRepository, useClass: PrismaEventsRepository },
  { provide: EventSessionsRepository, useClass: PrismaEventSessionsRepository },
  { provide: CategoriesRepository, useClass: PrismaCategoriesRepository },
  { provide: VenuesRepository, useClass: PrismaVenuesRepository },
  { provide: OrganizationsRepository, useClass: PrismaOrganizationsRepository },
  { provide: AccountsRepository, useClass: PrismaAccountsRepository },
  { provide: VerificationCodesRepository, useClass: PrismaVerificationCodesRepository },
  { provide: SessionsRepository, useClass: PrismaSessionsRepository },
  { provide: ProfilesRepository, useClass: PrismaProfilesRepository },
  { provide: ListingsRepository, useClass: PrismaListingsRepository },
  { provide: InterestsRepository, useClass: PrismaInterestsRepository },
  { provide: MatchesRepository, useClass: PrismaMatchesRepository },
  { provide: ApplicationsRepository, useClass: PrismaApplicationsRepository },
  { provide: ReportCasesRepository, useClass: PrismaReportCasesRepository },
  { provide: AuditLogRepository, useClass: PrismaAuditLogRepository },
  { provide: BackupRunsRepository, useClass: PrismaBackupRunsRepository },
  { provide: ImportRunsRepository, useClass: PrismaImportRunsRepository },
];

const adapters = [
  { provide: TransactionRunner, useClass: PrismaTransactionRunner },
  { provide: DatabaseProbe, useClass: PrismaDatabaseProbe },
  { provide: JobQueue, useFactory: jobQueue },
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

function jobQueue(): JobQueue {
  const connectionString = process.env.MAIN_DATABASE_URL;
  if (!connectionString) {
    throw new Error('MAIN_DATABASE_URL is not set: see .env.example');
  }
  return new PgBossJobQueue(connectionString);
}

function messagingProvider(): MessagingProvider {
  const settings = loadMessagingSettings();
  if (settings.provider === 'disabled') {
    return new DisabledMessagingProvider();
  }
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
