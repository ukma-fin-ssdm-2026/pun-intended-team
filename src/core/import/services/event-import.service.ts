// Written with the help of Claude
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Venue } from '../../catalog/types/venue.ts';
import { EVENT_PROVIDERS, EventProvider } from '../adapters/event-provider.ts';
import { Geocoder } from '../adapters/geocoder.ts';
import { ImportedEventsRepository } from '../repositories/imported-events.repository.ts';
import type {
  ImportedEvent,
  ImportedEventFields,
  ImportedEventRow,
  ImportReport,
  ImportRunSummary,
  SkippedRecord,
} from '../types/import.ts';

type Saved = 'created' | 'updated' | 'unchanged';

/** FR-008: takes the events of the external providers into the catalog. */
@Injectable()
export class EventImportService {
  private readonly logger = new Logger(EventImportService.name);

  constructor(
    @Inject(EVENT_PROVIDERS) private readonly providers: EventProvider[],
    private readonly importedEventsRepository: ImportedEventsRepository,
    private readonly geocoder: Geocoder,
  ) {}

  /** Imports from every provider in turn; one that fails does not stop the others. */
  async run(): Promise<ImportRunSummary> {
    const summary: ImportRunSummary = { reports: [], failed: [] };
    for (const provider of this.providers) {
      try {
        summary.reports.push(await this.importFrom(provider));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`${provider.id}: the run failed: ${message}`);
        summary.failed.push({ provider: provider.id, error: message });
      }
    }
    return summary;
  }

  /**
   * Fetches one provider's records and saves each usable one. A record that cannot be used is skipped, kept with
   * its reason and reported (FR-015); the rest are still imported. A second run changes only what the provider
   * changed. Every run is recorded; one that fails, e.g. because the provider is down, is recorded as failed and
   * leaves the events of earlier runs as they are (FR-014).
   */
  async importFrom(provider: EventProvider): Promise<ImportReport> {
    const since = await this.importedEventsRepository.lastSucceededRunStart(provider.id);
    const runId = await this.importedEventsRepository.startRun(provider.id);
    try {
      const report = await this.importRecords(provider, runId, since);
      await this.importedEventsRepository.finishRun(runId, 'succeeded');
      return report;
    } catch (error) {
      await this.importedEventsRepository.finishRun(runId, 'failed');
      throw error;
    }
  }

  private async importRecords(provider: EventProvider, runId: string, since?: Date): Promise<ImportReport> {
    const raws = await provider.fetch(since);
    const categories = new Map(
      (await this.importedEventsRepository.findCategories()).map((category) => [category.slug, category]),
    );
    const report: ImportReport = {
      provider: provider.id,
      fetched: raws.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: [],
    };
    // Addresses the geocoder could not find in this run, so a venue with many events is asked about once.
    const notFound = new Set<string>();

    for (const raw of raws) {
      const result = provider.normalize(raw);
      if ('skip' in result) {
        await this.skip(report, runId, raw, result.skip);
        continue;
      }
      const imported = result.event;
      const skip = (reason: string) => this.skip(report, runId, raw, { externalId: imported.externalId, reason });
      const category = categories.get(imported.categorySlug);
      if (!category) {
        await skip(`Unknown category ${JSON.stringify(imported.categorySlug)}`);
        continue;
      }
      if (!category.isActive) {
        await skip(`Inactive category ${JSON.stringify(imported.categorySlug)}`);
        continue;
      }
      if (!(Date.parse(imported.endsAt) > Date.parse(imported.startsAt))) {
        await skip('The event does not end after it starts');
        continue;
      }
      const venue = await this.venueFor(imported, notFound);
      if (typeof venue === 'string') {
        await skip(venue);
        continue;
      }
      report[await this.save(provider.id, imported, category.id, venue.id)]++;
    }

    this.logger.log(
      `${report.provider}: fetched ${report.fetched}, created ${report.created}, updated ${report.updated}, ` +
        `unchanged ${report.unchanged}, skipped ${report.skipped.length}`,
    );
    return report;
  }

  /**
   * The saved venue with the event's name and address, which keeps the coordinates found before; otherwise a new
   * one, with the provider's coordinates or the geocoder's. A string is the reason the event has no venue.
   */
  private async venueFor({ venue }: ImportedEvent, notFound: Set<string>): Promise<Venue | string> {
    const known = await this.importedEventsRepository.findVenue(venue.name, venue.address);
    if (known) {
      return known;
    }
    if (venue.location) {
      return this.importedEventsRepository.createVenue({ ...venue, location: venue.location });
    }
    const key = `${venue.name}\n${venue.address}`;
    if (notFound.has(key)) {
      return 'The geocoder found no coordinates for the venue';
    }
    let location: Venue['location'] | undefined;
    try {
      location = await this.geocoder.locate(venue);
    } catch (error) {
      return `The geocoder failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (!location) {
      notFound.add(key);
      return 'The geocoder found no coordinates for the venue';
    }
    return this.importedEventsRepository.createVenue({ ...venue, location });
  }

  private async save(provider: string, imported: ImportedEvent, categoryId: string, venueId: string): Promise<Saved> {
    const { externalId, title, description, startsAt, endsAt, imageUrl, sourceUrl } = imported;
    const fields: ImportedEventFields = {
      title,
      description,
      categoryId,
      venueId,
      startsAt,
      endsAt,
      imageUrl,
      sourceUrl,
    };

    const existing = await this.importedEventsRepository.findEvent(provider, externalId);
    if (!existing) {
      await this.importedEventsRepository.createEvent({ ...fields, provider, externalId });
      return 'created';
    }
    if (isSame(existing, fields)) {
      return 'unchanged';
    }
    await this.importedEventsRepository.updateEvent(existing.id, fields);
    return 'updated';
  }

  private async skip(report: ImportReport, runId: string, raw: unknown, record: SkippedRecord): Promise<void> {
    report.skipped.push(record);
    await this.importedEventsRepository.saveSkipped(runId, raw, record.reason);
    this.logger.warn(`${report.provider}: skipped ${record.externalId ?? 'a record without id'}: ${record.reason}`);
  }
}

function isSame(event: ImportedEventRow, fields: ImportedEventFields): boolean {
  return (
    event.title === fields.title &&
    event.description === fields.description &&
    event.categoryId === fields.categoryId &&
    event.venueId === fields.venueId &&
    event.imageUrl === fields.imageUrl &&
    event.sourceUrl === fields.sourceUrl &&
    Date.parse(event.startsAt) === Date.parse(fields.startsAt) &&
    Date.parse(event.endsAt) === Date.parse(fields.endsAt)
  );
}
