// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { EventProvider } from '../core/import/adapters/event-provider.ts';
import { ImportedEventsRepository } from '../core/import/repositories/imported-events.repository.ts';
import { ImportPrismaService } from './prisma/import-prisma.service.ts';
import { PrismaImportedEventsRepository } from './prisma/prisma-imported-events.repository.ts';
import { ConcertUaEventProvider } from './providers/concert-ua-event-provider.ts';

/**
 * Everything the import needs from `infra`, and nothing of the API's: its own database connection as
 * `nearby_import` and the provider adapter, with no key files and no `MAIN_DATABASE_URL`. Only the import's start
 * command (`src/import/`) loads this module.
 */
@Global()
@Module({
  providers: [
    ImportPrismaService,
    { provide: ImportedEventsRepository, useClass: PrismaImportedEventsRepository },
    { provide: EventProvider, useFactory: () => new ConcertUaEventProvider() },
  ],
  exports: [ImportedEventsRepository, EventProvider],
})
export class ImportInfraModule {}
