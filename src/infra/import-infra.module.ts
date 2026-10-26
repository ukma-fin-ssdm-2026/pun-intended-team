// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { EventProvider } from '../core/import/adapters/event-provider.ts';
import { ImportedEventsRepository } from '../core/import/repositories/imported-events.repository.ts';
import { ConcertUaEventProvider } from './providers/concert-ua-event-provider.ts';
import { StubImportedEventsRepository } from './stubs/imported-events.repository.ts';

/**
 * The import's bindings, kept out of InfraModule so the API never builds a provider adapter. Only the import's
 * start command (`src/import/`) loads this module.
 */
@Global()
@Module({
  providers: [
    { provide: ImportedEventsRepository, useClass: StubImportedEventsRepository },
    { provide: EventProvider, useFactory: () => new ConcertUaEventProvider() },
  ],
  exports: [ImportedEventsRepository, EventProvider],
})
export class ImportInfraModule {}
