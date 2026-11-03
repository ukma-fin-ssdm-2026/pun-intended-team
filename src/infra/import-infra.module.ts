// Written with the help of Claude
import { Global, Module } from '@nestjs/common';
import { EVENT_PROVIDERS } from '../core/import/adapters/event-provider.ts';
import { Geocoder } from '../core/import/adapters/geocoder.ts';
import { ImportedEventsRepository } from '../core/import/repositories/imported-events.repository.ts';
import { NominatimGeocoder } from './geocoding/nominatim-geocoder.ts';
import { ImportPrismaService } from './prisma/import-prisma.service.ts';
import { PrismaImportedEventsRepository } from './prisma/prisma-imported-events.repository.ts';
import { ArtWizardEventProvider } from './providers/artwizard-event-provider.ts';
import { PoliteHttpClient } from './providers/http-client.ts';
import { importSettings } from './providers/import-settings.ts';
import { KarabasEventProvider } from './providers/karabas-event-provider.ts';

/**
 * Everything the import needs from `infra`, and nothing of the API's: its own database connection as
 * `nearby_import`, the provider adapters and the geocoder, with no key files and no `MAIN_DATABASE_URL`. Only the
 * import's start command (`src/import/`) loads this module.
 */
@Global()
@Module({
  providers: [
    ImportPrismaService,
    { provide: ImportedEventsRepository, useClass: PrismaImportedEventsRepository },
    {
      provide: EVENT_PROVIDERS,
      useFactory: () => {
        const { userAgent, intervalMs, artWizardBaseUrl, karabasBaseUrl, now } = importSettings();
        // One client per site, each with that site's robots.txt rules.
        const client = (disallowedPaths: string[]) => new PoliteHttpClient({ userAgent, intervalMs, disallowedPaths });
        return [
          new ArtWizardEventProvider({
            http: client(['/api/', '/internal/', '/cdn-cgi/']),
            baseUrl: artWizardBaseUrl,
            now,
          }),
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
  exports: [ImportedEventsRepository, EVENT_PROVIDERS, Geocoder],
})
export class ImportInfraModule {}
