// Written with the help of Claude
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Venue } from '../../catalog/types/venue.ts';
import { Clock } from '../adapters/clock.ts';
import { EVENT_PROVIDERS, EventProvider } from '../adapters/event-provider.ts';
import { Geocoder } from '../adapters/geocoder.ts';
import { inKyiv } from '../../common/kyiv-area.ts';
import { ImportedEventsRepository } from '../repositories/imported-events.repository.ts';
import { similarTitles } from './event-match.ts';
import { SavedVenues } from './venue-match.ts';
import type {
  CompleteRun,
  FetchResult,
  ImportedEvent,
  ImportedEventFields,
  ImportedEventRow,
  ImportReport,
  ImportRunSummary,
  NewImportedVenue,
  NotStartedRun,
  RunDetails,
  RunOptions,
  SkippedRecord,
} from '../types/import.ts';

/**
 * The geocoder's state for one run. Addresses it could not find are asked about once, so a venue with many events
 * costs one lookup. After it fails, e.g. because it cannot be reached, it is not asked again: every lookup would
 * wait for its retries and fail the same way.
 */
interface Geocoding {
  notFound: Set<string>;
  unavailable: boolean;
}

const GEOCODER_UNAVAILABLE = 'The geocoder is unavailable in this run';

type Saved = 'created' | 'updated' | 'unchanged' | 'republished';

/** A complete list is taken as broken, and cancels nothing, when it sees fewer than this share of the last one's. */
const LEAST_SHARE_OF_LAST_LIST = 0.5;

const HOUR_MS = 60 * 60 * 1000;

/** FR-008: takes the events of the external providers into the catalog. */
@Injectable()
export class EventImportService {
  private readonly logger = new Logger(EventImportService.name);

  constructor(
    @Inject(EVENT_PROVIDERS) private readonly providers: EventProvider[],
    private readonly importedEventsRepository: ImportedEventsRepository,
    private readonly geocoder: Geocoder,
    private readonly clock: Clock,
  ) {}

  /** Imports from every provider in turn; one that fails, or is not started, does not stop the others. */
  async run(options: RunOptions = {}): Promise<ImportRunSummary> {
    const summary: ImportRunSummary = { reports: [], failed: [], notStarted: [] };
    for (const provider of this.providers) {
      await this.runOne(provider, options, summary);
    }
    return summary;
  }

  /** Imports from one provider, as the job `import.run` asks; undefined when no provider has the id. */
  async runProvider(providerId: string, options: RunOptions = {}): Promise<ImportRunSummary | undefined> {
    const provider = this.providers.find(({ id }) => id === providerId);
    if (!provider) {
      return undefined;
    }
    const summary: ImportRunSummary = { reports: [], failed: [], notStarted: [] };
    await this.runOne(provider, options, summary);
    return summary;
  }

  private async runOne(provider: EventProvider, { force = false }: RunOptions, summary: ImportRunSummary) {
    try {
      const tooSoon = force ? undefined : await this.tooSoon(provider);
      if (tooSoon) {
        this.logger.warn(
          `${provider.id}: not started: the last run started at ${tooSoon.lastStartedAt}, ` +
            `the next may start at ${tooSoon.allowedFrom}`,
        );
        summary.notStarted.push(tooSoon);
        return;
      }
      if (force) {
        this.logger.warn(`${provider.id}: started without checking when the last run started (--force)`);
      }
      summary.reports.push(await this.importFrom(provider));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${provider.id}: the run failed: ${message}`);
      summary.failed.push({ provider: provider.id, error: message });
    }
  }

  /**
   * The run is not started when the provider's last run, whatever its outcome, started less than its
   * `minHoursBetweenRuns` ago: ArtWizard allows one update a day (ADR-006, decision 9). Checked before an unfinished
   * run is marked failed, so a run still going in another process is never touched.
   */
  private async tooSoon(provider: EventProvider): Promise<NotStartedRun | undefined> {
    const last = await this.importedEventsRepository.lastRunStart(provider.id);
    if (!last) {
      return undefined;
    }
    const allowedFrom = new Date(last.getTime() + provider.minHoursBetweenRuns * HOUR_MS);
    if (this.clock.now() >= allowedFrom) {
      return undefined;
    }
    return { provider: provider.id, lastStartedAt: last.toISOString(), allowedFrom: allowedFrom.toISOString() };
  }

  /**
   * Fetches one provider's records and saves each usable one. A record that cannot be used is skipped, kept with
   * its reason and reported (FR-015); the rest are still imported. A second run changes only what the provider
   * changed. Every run is recorded; one that fails, e.g. because the provider is down, is recorded as failed and
   * leaves the events of earlier runs as they are (FR-014).
   *
   * After a complete list, the provider's imported events that it no longer lists are cancelled, and a cancelled
   * one it lists again is published again (ADR-006). A failed run, or a list that is not complete, cancels nothing.
   *
   * The error that stopped the run is the one thrown, even when recording the failure fails too. When the database
   * cannot record the run at all, the run stays `running`, and the provider's next run marks it failed first.
   */
  async importFrom(provider: EventProvider): Promise<ImportReport> {
    await this.importedEventsRepository.failUnfinishedRuns(provider.id);
    const runId = await this.importedEventsRepository.startRun(provider.id);
    let result: { report: ImportReport; details: RunDetails };
    try {
      result = await this.importRecords(provider, runId);
    } catch (error) {
      await this.recordFailure(provider.id, runId);
      throw error;
    }
    await this.importedEventsRepository.finishRun(runId, 'succeeded', result.details);
    return result.report;
  }

  /** Records the run as failed; an error doing so is logged, so it never replaces the error that stopped the run. */
  private async recordFailure(providerId: string, runId: string): Promise<void> {
    try {
      await this.importedEventsRepository.finishRun(runId, 'failed');
    } catch (error) {
      this.logger.error(
        `${providerId}: could not record run ${runId} as failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async importRecords(
    provider: EventProvider,
    runId: string,
  ): Promise<{ report: ImportReport; details: RunDetails }> {
    const list = await provider.fetch();
    const { records: raws, complete } = list;
    const categories = new Map(
      (await this.importedEventsRepository.findCategories()).map((category) => [category.slug, category]),
    );
    const report: ImportReport = {
      provider: provider.id,
      complete,
      fetched: raws.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      cancelled: 0,
      republished: 0,
      skipped: [],
    };
    const geocoding: Geocoding = { notFound: new Set(), unavailable: false };
    const venues = new SavedVenues(await this.importedEventsRepository.findVenues());
    // The provider's events this run saw: saved, or skipped only because the geocoder failed or found nothing,
    // which says nothing about whether the event still exists.
    const seen = new Set<string>();

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
      const venue = await this.venueFor(report.provider, imported, venues, geocoding);
      seen.add(imported.externalId);
      if (typeof venue === 'string') {
        await skip(venue);
        continue;
      }
      const saved = await this.save(provider.id, imported, category.id, venue.id);
      if (typeof saved === 'object') {
        // Seen all the same: the provider still lists it, so it is no reason to cancel anything.
        await skip(`Duplicate of ${saved.duplicateOf.provider} event ${saved.duplicateOf.id}`);
        continue;
      }
      count(report, saved);
    }

    const last = await this.importedEventsRepository.lastCompleteRun(provider.id);
    const brokenBecause = complete ? whyBroken(list, seen.size, last) : 'the list is not complete';
    if (brokenBecause) {
      this.logger.warn(`${report.provider}: cancelling nothing: ${brokenBecause}`);
    } else {
      report.cancelled = await this.importedEventsRepository.cancelUnseen(provider.id, [...seen], list.covers);
    }
    report.complete = !brokenBecause;

    this.logger.log(
      `${report.provider}: fetched ${report.fetched}, created ${report.created}, updated ${report.updated} ` +
        `(republished ${report.republished}), unchanged ${report.unchanged}, cancelled ${report.cancelled}, ` +
        `skipped ${report.skipped.length}; ` +
        (report.complete ? 'the full list' : 'not the full list'),
    );
    return { report, details: { complete: report.complete, seen: seen.size, parts: list.parts } };
  }

  /**
   * The saved venue at the same address with a similar name (ADR-006, decision 7), which keeps the coordinates found
   * before; a provider's coordinates in Kyiv replace them. Otherwise a new venue, with the provider's coordinates or
   * the geocoder's. A string is the reason the event has no venue.
   */
  private async venueFor(
    providerId: string,
    { venue }: ImportedEvent,
    venues: SavedVenues,
    geocoding: Geocoding,
  ): Promise<Venue | string> {
    const { name, address, location } = venue;
    const saved = venues.find(venue);
    if (saved) {
      if (saved.name !== name) {
        this.logger.debug(`Venue "${name}" at ${address}: the saved "${saved.name}"`);
      }
      if (!location || sameLocation(saved.location, location)) {
        return saved;
      }
      if (!inKyiv(location)) {
        this.logger.warn(
          `Venue "${name}" at ${address}: coordinates ${location.lat}, ${location.lng} are not in Kyiv; kept`,
        );
        return saved;
      }
      const moved = await this.importedEventsRepository.updateVenueLocation(saved.id, location);
      venues.replace(moved);
      return moved;
    }
    if (location) {
      return this.created(venues, { name, address, location });
    }
    if (geocoding.unavailable) {
      return GEOCODER_UNAVAILABLE;
    }
    const key = `${name}\n${address}`;
    if (geocoding.notFound.has(key)) {
      return 'The geocoder found no coordinates for the venue';
    }
    let found: Venue['location'] | undefined;
    try {
      found = await this.geocoder.locate(venue);
    } catch (error) {
      geocoding.unavailable = true;
      this.logger.error(
        `${providerId}: the geocoder failed, so it is not asked again in this run: ` +
          (error instanceof Error ? error.message : String(error)),
      );
      return GEOCODER_UNAVAILABLE;
    }
    if (!found) {
      geocoding.notFound.add(key);
      return 'The geocoder found no coordinates for the venue';
    }
    return this.created(venues, { name, address, location: found });
  }

  private async created(venues: SavedVenues, venue: NewImportedVenue): Promise<Venue> {
    const saved = await this.importedEventsRepository.createVenue(venue);
    venues.add(saved);
    return saved;
  }

  /**
   * Creates or updates the provider's event for the record. A record the provider has no event for yet, which another
   * provider's published event at the same venue and start time with a similar title already shows, is not saved:
   * that event is returned instead (ADR-006, decision 8).
   */
  private async save(
    provider: string,
    imported: ImportedEvent,
    categoryId: string,
    venueId: string,
  ): Promise<Saved | { duplicateOf: ImportedEventRow }> {
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
      const others = await this.importedEventsRepository.findOtherProvidersEvents(provider, venueId, startsAt);
      const duplicateOf = others.find((other) => similarTitles(other.title, title));
      if (duplicateOf) {
        return { duplicateOf };
      }
      await this.importedEventsRepository.createEvent({ ...fields, provider, externalId });
      return 'created';
    }
    if (existing.status === 'published' && isSame(existing, fields)) {
      return 'unchanged';
    }
    await this.importedEventsRepository.updateEvent(existing.id, fields);
    return existing.status === 'cancelled' ? 'republished' : 'updated';
  }

  private async skip(report: ImportReport, runId: string, raw: unknown, record: SkippedRecord): Promise<void> {
    report.skipped.push(record);
    await this.importedEventsRepository.saveSkipped(runId, raw, record.reason);
    this.logger.warn(`${report.provider}: skipped ${record.externalId ?? 'a record without id'}: ${record.reason}`);
  }
}

/**
 * Why a complete list still looks broken: it saw no records, or, compared with the provider's last complete list, it
 * saw fewer than half as many, or a part that listed records then lists none now. Undefined when it looks whole.
 */
function whyBroken(list: FetchResult, seen: number, last: CompleteRun | undefined): string | undefined {
  if (seen === 0) {
    return 'it saw no records';
  }
  if (!last) {
    return undefined;
  }
  if (seen < last.seen * LEAST_SHARE_OF_LAST_LIST) {
    return `it saw ${seen} records, under half of the ${last.seen} of the last complete list`;
  }
  const now = new Map(Object.entries(list.parts ?? {}));
  const emptied = Object.entries(last.parts)
    .filter(([part, count]) => count > 0 && (now.get(part) ?? 0) === 0)
    .map(([part]) => part);
  return emptied.length > 0 ? `${emptied.join(', ')} listed records in the last complete list and none now` : undefined;
}

/** Counts a saved record in the report; a republished event is also an updated one. */
function count(report: ImportReport, saved: Saved): void {
  if (saved === 'created') {
    report.created++;
  } else if (saved === 'unchanged') {
    report.unchanged++;
  } else {
    report.updated++;
    if (saved === 'republished') {
      report.republished++;
    }
  }
}

/** The same point at the precision the database keeps, `decimal(9, 6)`. */
function sameLocation(a: Venue['location'], b: Venue['location']): boolean {
  return a.lat.toFixed(6) === b.lat.toFixed(6) && a.lng.toFixed(6) === b.lng.toFixed(6);
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
