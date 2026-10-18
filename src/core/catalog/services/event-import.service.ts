// Written with the help of Claude
import { Injectable, Logger } from '@nestjs/common';
import { EventProvider } from '../adapters/event-provider.ts';
import { EventsRepository } from '../repositories/events.repository.ts';
import { VenuesRepository } from '../repositories/venues.repository.ts';
import type { Event } from '../types/event.ts';
import type { ImportedEvent, ImportReport, SkippedRecord } from '../types/import.ts';
import { CategoriesService } from './categories.service.ts';

/** FR-008: takes the events of one external provider into the catalog. */
@Injectable()
export class EventImportService {
  private readonly logger = new Logger(EventImportService.name);

  constructor(
    private readonly provider: EventProvider,
    private readonly eventsRepository: EventsRepository,
    private readonly venuesRepository: VenuesRepository,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Fetches the provider's records and saves each usable one. A record that cannot be used is skipped and
   * reported (FR-015), the rest are still imported. A second run changes only what the provider changed.
   */
  async run(): Promise<ImportReport> {
    const raws = await this.provider.fetch();
    const categoryIdsByName = new Map(
      (await this.categoriesService.listActive()).map((category) => [category.name.toLowerCase(), category.id]),
    );
    const report: ImportReport = {
      provider: this.provider.id,
      fetched: raws.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: [],
    };

    for (const raw of raws) {
      const result = this.provider.normalize(raw);
      if ('skip' in result) {
        this.skip(report, result.skip);
        continue;
      }
      const imported = result.event;
      const categoryId = categoryIdsByName.get(imported.categoryName.toLowerCase());
      if (!categoryId) {
        this.skip(report, { externalId: imported.externalId, reason: `Unknown category "${imported.categoryName}"` });
        continue;
      }
      if (!(Date.parse(imported.endsAt) > Date.parse(imported.startsAt))) {
        this.skip(report, { externalId: imported.externalId, reason: 'The event does not end after it starts' });
        continue;
      }
      report[await this.save(imported, categoryId)]++;
    }

    this.logger.log(
      `${report.provider}: fetched ${report.fetched}, created ${report.created}, updated ${report.updated}, ` +
        `unchanged ${report.unchanged}, skipped ${report.skipped.length}`,
    );
    return report;
  }

  private async save(imported: ImportedEvent, categoryId: string): Promise<'created' | 'updated' | 'unchanged'> {
    const { venue: importedVenue, externalId, title, description, startsAt, endsAt } = imported;
    const venue =
      (await this.venuesRepository.findImported(importedVenue.name, importedVenue.address)) ??
      (await this.venuesRepository.createImported(importedVenue));
    const fields = { title, description, categoryId, venueId: venue.id, startsAt, endsAt };

    const existing = await this.eventsRepository.findByExternalId(this.provider.id, externalId);
    if (!existing) {
      await this.eventsRepository.createImported({
        ...fields,
        source: 'import',
        status: 'published',
        organizationId: null,
        provider: this.provider.id,
        externalId,
      });
      return 'created';
    }
    if (isSame(existing, fields)) {
      return 'unchanged';
    }
    await this.eventsRepository.update(existing.id, fields);
    return 'updated';
  }

  private skip(report: ImportReport, record: SkippedRecord): void {
    report.skipped.push(record);
    this.logger.warn(`${report.provider}: skipped ${record.externalId ?? 'a record without id'}: ${record.reason}`);
  }
}

function isSame(
  event: Event,
  fields: { title: string; description: string; categoryId: string; venueId: string; startsAt: string; endsAt: string },
): boolean {
  return (
    event.title === fields.title &&
    event.description === fields.description &&
    event.category.id === fields.categoryId &&
    event.venue.id === fields.venueId &&
    Date.parse(event.startsAt) === Date.parse(fields.startsAt) &&
    Date.parse(event.endsAt) === Date.parse(fields.endsAt)
  );
}
