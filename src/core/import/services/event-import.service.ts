// Written with the help of Claude
import { Injectable, Logger } from '@nestjs/common';
import { CategoriesService } from '../../catalog/services/categories.service.ts';
import { EventProvider } from '../adapters/event-provider.ts';
import { ImportedEventsRepository } from '../repositories/imported-events.repository.ts';
import type {
  ImportedEvent,
  ImportedEventFields,
  ImportedEventRow,
  ImportReport,
  SkippedRecord,
} from '../types/import.ts';

/** FR-008: takes the events of one external provider into the catalog. */
@Injectable()
export class EventImportService {
  private readonly logger = new Logger(EventImportService.name);

  constructor(
    private readonly provider: EventProvider,
    private readonly importedEventsRepository: ImportedEventsRepository,
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
      (await this.importedEventsRepository.findVenue(importedVenue.name, importedVenue.address)) ??
      (await this.importedEventsRepository.createVenue(importedVenue));
    const fields: ImportedEventFields = { title, description, categoryId, venueId: venue.id, startsAt, endsAt };

    const existing = await this.importedEventsRepository.findEvent(this.provider.id, externalId);
    if (!existing) {
      await this.importedEventsRepository.createEvent({ ...fields, provider: this.provider.id, externalId });
      return 'created';
    }
    if (isSame(existing, fields)) {
      return 'unchanged';
    }
    await this.importedEventsRepository.updateEvent(existing.id, fields);
    return 'updated';
  }

  private skip(report: ImportReport, record: SkippedRecord): void {
    report.skipped.push(record);
    this.logger.warn(`${report.provider}: skipped ${record.externalId ?? 'a record without id'}: ${record.reason}`);
  }
}

function isSame(event: ImportedEventRow, fields: ImportedEventFields): boolean {
  return (
    event.title === fields.title &&
    event.description === fields.description &&
    event.categoryId === fields.categoryId &&
    event.venueId === fields.venueId &&
    Date.parse(event.startsAt) === Date.parse(fields.startsAt) &&
    Date.parse(event.endsAt) === Date.parse(fields.endsAt)
  );
}
