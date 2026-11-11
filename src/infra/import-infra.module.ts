// Written with the help of Claude
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { Clock } from '../core/import/adapters/clock.ts';
import { EVENT_PROVIDERS } from '../core/import/adapters/event-provider.ts';
import { Geocoder } from '../core/import/adapters/geocoder.ts';
import { ImportedEventsRepository } from '../core/import/repositories/imported-events.repository.ts';
import { JobQueue } from '../core/jobs/adapters/job-queue.ts';
import { NominatimGeocoder } from './geocoding/nominatim-geocoder.ts';
import { ImportPrismaService } from './prisma/import-prisma.service.ts';
import { PgBossJobQueue } from './jobs/pg-boss-job-queue.ts';
import { PrismaImportedEventsRepository } from './prisma/prisma-imported-events.repository.ts';
import { ArtWizardEventProvider } from './providers/artwizard-event-provider.ts';
import { PoliteHttpClient } from './providers/http-client.ts';
import { importSettings } from './providers/import-settings.ts';
import { KarabasEventProvider } from './providers/karabas-event-provider.ts';

/**
 * Everything the import needs from `infra`, and nothing of the API's: its own database connection as
 * `nearby_import`, the provider adapters and the geocoder, with no key files and no `MAIN_DATABASE_URL`. Only the
 * import's start command (`src/import/`) loads this module: as it is for a one-off run, and `withJobQueue()` for the
 * long-running process that runs `import.run`.
 */
@Global()
@Module({
  providers: [
    ImportPrismaService,
    { provide: ImportedEventsRepository, useClass: PrismaImportedEventsRepository },
    { provide: Clock, useValue: { now: () => new Date() } satisfies Clock },
    {
      provide: EVENT_PROVIDERS,
      useFactory: () => {
        const { userAgent, intervalMs, artWizardApiKey, artWizardApiUrl, karabasBaseUrl, now } = importSettings();
        // One client per site, each with that site's robots.txt rules.
        const client = (disallowedPaths: string[]) => new PoliteHttpClient({ userAgent, intervalMs, disallowedPaths });
        return [
          new ArtWizardEventProvider({ http: client([]), apiKey: artWizardApiKey, apiUrl: artWizardApiUrl, now }),
          new KarabasEventProvider({ http: client(['/ajax.php']), baseUrl: karabasBaseUrl, now }),
        ];
      },
    },
    {
      provide: Geocoder,
      useFactory: () => {
        const { userAgent, intervalMs, nominatimBaseUrl } = importSettings();
        return new NominatimGeocoder(new PoliteHttpClient({ userAgent, intervalMs }), nominatimBaseUrl);
      },
    },
  ],
  exports: [ImportedEventsRepository, EVENT_PROVIDERS, Geocoder, Clock],
})
export class ImportInfraModule {
  /**
   * With the job queue too, also as `nearby_import` (its grants on the schema `pgboss` come from the
   * `import_job_queue` migration). A one-off run leaves it out, so it never starts pg-boss.
   */
  static withJobQueue(): DynamicModule {
    return {
      module: ImportInfraModule,
      providers: [{ provide: JobQueue, useFactory: () => new PgBossJobQueue(importDatabaseUrl()) }],
      exports: [JobQueue],
    };
  }
}

function importDatabaseUrl(): string {
  const connectionString = process.env.IMPORT_DATABASE_URL;
  if (!connectionString) {
    throw new Error('IMPORT_DATABASE_URL is not set: see .env.example');
  }
  return connectionString;
}
