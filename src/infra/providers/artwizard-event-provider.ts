// Written with the help of Claude
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { catalogWindow } from '../../core/common/catalog-window.ts';
import { addDays, fromKyivWallClock, kyivEndOfDay } from '../../core/common/kyiv-time.ts';
import { EventProvider } from '../../core/import/adapters/event-provider.ts';
import type { FetchResult, NormalizeResult } from '../../core/import/types/import.ts';
import { type HttpClient, redactedUrl } from './http-client.ts';
import { coveredInstants, errorMessage, fitDescription, fitTitle } from './provider-pages.ts';

export const ARTWIZARD_API_URL = 'https://api.artwizard.io';
/** Where the event pages are; `sourceUrl` points there, never to `details_url`, which is empty or another site. */
const ARTWIZARD_SITE_URL = 'https://artwizard.io';
const PAGE_SIZE = 20;
/** A stop for a response whose `total_pages` is wrong: Kyiv had 4 pages of 20 on 2026-11-03. */
const MAX_PAGES = 50;
/**
 * ArtWizard's permission covers Kyiv events of the coming 4 weeks (ADR-006, decision 9): today and the 27 days
 * after it, one day less than the catalog window.
 */
const DAYS_AHEAD = 27;

/** ArtWizard's event types (`type`), and the slug of our category for each; the first known type wins. */
export const ARTWIZARD_CATEGORY_SLUGS = new Map<string, string>([
  ['Музика', 'concerts'],
  ['Виставки', 'exhibitions'],
  ['Дискусії та лекції', 'talks'],
  ['Література', 'talks'],
  ['Майстер-класи', 'workshops'],
  ['Кіно', 'cinema'],
  ['Театр', 'theatre'],
  ['Гумор', 'stand-up'],
  ['Фестивалі', 'festivals'],
  ['Вечірки', 'parties'],
]);

const EventsPage = z.object({
  total: z.number().int(),
  total_pages: z.number().int().min(0),
  data: z.array(z.unknown()),
});

const Occurrence = z.object({
  date_from: z.iso.datetime({ offset: true }),
  date_to: z.iso.datetime({ offset: true }),
});
type Occurrence = z.infer<typeof Occurrence>;

const RawEvent = z.object({
  title: z.string().trim().min(1),
  description: z.string().nullish(),
  status: z.string(),
  type: z.array(z.string()).default([]),
  picture_url: z.string().nullish(),
  location: z.object({
    name_ua: z.string().trim().min(1),
    address_ua: z.string().trim().nullish(),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    city: z.object({ slug: z.string(), name: z.string().trim().nullish() }).nullish(),
  }),
  event_occurrences_data: z.array(Occurrence).default([]),
});

export interface ArtWizardOptions {
  http: HttpClient;
  /** Sent as the `apiKey` query parameter; never logged. */
  apiKey: string;
  apiUrl?: string;
  now?: () => Date;
}

/**
 * ArtWizard (artwizard.io) behind the EventProvider port, through the events API ArtWizard gave us access to
 * (ADR-006). One request per page of 20 Kyiv events whose occurrences touch the coming 4 weeks.
 */
export class ArtWizardEventProvider extends EventProvider {
  readonly id = 'artwizard';
  /** ArtWizard allows at most one update a day (ADR-006, decision 9). */
  override readonly minHoursBetweenRuns = 20;
  private readonly logger = new Logger(ArtWizardEventProvider.name);
  private readonly http: HttpClient;
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly now: () => Date;

  constructor({ http, apiKey, apiUrl = ARTWIZARD_API_URL, now = () => new Date() }: ArtWizardOptions) {
    super();
    this.http = http;
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
    this.now = now;
  }

  /**
   * Every page of the answer. The list is complete only when every page the API names was read and they held as
   * many distinct events as its `total`; an event added while the pages are read shifts the later pages by one, so
   * one event comes twice and another not at all.
   */
  async fetch(): Promise<FetchResult> {
    if (!this.apiKey) {
      throw new Error('ARTWIZARD_API_KEY is not set: see .env.example');
    }
    const now = this.now();
    const window = permittedWindow(now);
    const events: unknown[] = [];
    // The page each slug was first read on. A slug on two pages means the order shifted while the pages were read,
    // so another event was most likely never returned: it is kept once, and the list is not complete.
    const firstPage = new Map<string, number>();
    let total = 0;
    let totalPages = 0;
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const body = await this.fetchPage(window, page);
      for (const record of body.data) {
        const slug = slugOf(record);
        const seenOn = slug === undefined ? undefined : firstPage.get(slug);
        if (slug !== undefined && seenOn !== undefined) {
          this.logger.warn(`${slug}: listed again on page ${page}, first on page ${seenOn}; kept once`);
          continue;
        }
        if (slug !== undefined) {
          firstPage.set(slug, page);
        }
        events.push(record);
      }
      total = body.total;
      totalPages = body.total_pages;
      pages = Math.min(totalPages, MAX_PAGES);
    }
    this.logger.log(`${events.length} of ${total} Kyiv events from ${window.from} to ${window.to}, ${pages} pages`);
    const complete = totalPages <= MAX_PAGES && firstPage.size === total;
    if (!complete) {
      this.logger.warn(
        totalPages > MAX_PAGES
          ? `Not the full list: the API names ${totalPages} pages, only the first ${MAX_PAGES} were read`
          : `Not the full list: ${firstPage.size} distinct events read, the API names ${total}`,
      );
    }
    return { records: events, complete, covers: coveredInstants(now, window) };
  }

  private async fetchPage(window: { from: string; to: string }, page: number): Promise<z.infer<typeof EventsPage>> {
    const url = new URL('/events', this.apiUrl);
    url.search = new URLSearchParams({
      apiKey: this.apiKey,
      city: 'kyiv',
      'filter[event_occurrences_data.date_from:lte]': `date:${window.to}`,
      'filter[event_occurrences_data.date_to:gte]': `date:${window.from}`,
      page_size: String(PAGE_SIZE),
      page: String(page),
    }).toString();
    const shown = redactedUrl(url.href);
    let response;
    try {
      response = await this.http.get(url.href, { accept: 'application/json' });
    } catch (error) {
      // No `cause`: the original error may carry the URL with the key, and the import logs what it throws.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`GET ${shown} failed: ${errorMessage(error).replaceAll(this.apiKey, 'REDACTED')}`);
    }
    if (response.status !== 200) {
      throw new Error(`GET ${shown} answered ${response.status}`);
    }
    let json: unknown;
    try {
      json = JSON.parse(response.text);
    } catch {
      throw new Error(`GET ${shown} answered with something that is not JSON`);
    }
    const parsed = EventsPage.safeParse(json);
    if (!parsed.success) {
      throw new Error(`GET ${shown} answered without ${parsed.error.issues[0]?.path.join('.') || 'a page'}`);
    }
    return parsed.data;
  }

  normalize(raw: unknown): NormalizeResult {
    const externalId = slugOf(raw) ?? null;
    if (!externalId) {
      return { skip: { externalId: null, reason: 'Invalid record: slug' } };
    }
    const parsed = RawEvent.safeParse(raw);
    if (!parsed.success) {
      return { skip: { externalId, reason: `Invalid record: ${parsed.error.issues[0]?.path.join('.') || 'event'}` } };
    }
    const { title, description, status, type, picture_url, location, event_occurrences_data } = parsed.data;
    if (status !== 'published') {
      return { skip: { externalId, reason: `Not published (status ${JSON.stringify(status)})` } };
    }
    const city = location.city?.slug;
    if (city !== 'kyiv') {
      return { skip: { externalId, reason: `Not in Kyiv (city ${JSON.stringify(city ?? null)})` } };
    }
    const categorySlug = type.map((tag) => ARTWIZARD_CATEGORY_SLUGS.get(tag)).find(Boolean);
    if (!categorySlug) {
      return { skip: { externalId, reason: `No category for the types ${JSON.stringify(type)}` } };
    }

    const window = permittedWindow(this.now());
    const inWindow = event_occurrences_data
      .filter((occurrence) => occurrenceInWindow(occurrence, window))
      .sort((a, b) => a.date_from.localeCompare(b.date_from));
    const first = inWindow.find((occurrence) => !untimed(occurrence));
    if (inWindow.length > 1) {
      this.logger.log(
        `${externalId}: ${inWindow.length} occurrences from ${window.from} to ${window.to}; ` +
          (first ? `importing the one of ${first.date_from.slice(0, 16)} only` : 'none has a start time'),
      );
    }
    if (!first) {
      // ArtWizard shows 00:00 when the organizer gave no time; a midnight start would also move the matching rounds.
      return inWindow.length > 0
        ? { skip: { externalId, reason: 'No start time (00:00 on ArtWizard)' } }
        : { skip: { externalId, reason: `No occurrence from ${window.from} to ${window.to}` } };
    }
    // The API writes Kyiv time with a `Z`: 18:00 on the page is `18:00:00.000Z`.
    const start = fromKyivWallClock(first.date_from);
    const end = fromKyivWallClock(first.date_to);
    const coordinates =
      location.latitude != null && location.longitude != null
        ? { lat: location.latitude, lng: location.longitude }
        : null;
    return {
      event: {
        externalId,
        title: fitTitle(title),
        description: fitDescription(quillText(description ?? '')),
        categorySlug,
        venue: {
          name: location.name_ua,
          address: venueAddress(location.address_ua, location.city?.name),
          location: coordinates,
        },
        startsAt: start.toISOString(),
        // An end that is not after the start (date_to equal to date_from) means none: the end is unknown, and the
        // event lasts until the end of its day.
        endsAt: (end > start ? end : kyivEndOfDay(start)).toISOString(),
        endTimeKnown: end > start,
        imageUrl: picture_url || null,
        sourceUrl: `${ARTWIZARD_SITE_URL}/${city}/e/${encodeURIComponent(externalId)}`,
      },
    };
  }
}

/**
 * The venue's address with its city once: the import has always added the city, which some ArtWizard addresses
 * already end with ("вулиця Саксаганського, 6, Київ"). Venues saved before with the city twice are still found,
 * since the import compares addresses without the city (ADR-006, decision 7).
 */
export function venueAddress(address: string | null | undefined, city: string | null | undefined): string {
  const street = address?.trim() ?? '';
  const lastPart = street.split(',').at(-1)?.trim().toLowerCase();
  return city && street && lastPart === city.trim().toLowerCase() ? street : [street, city].filter(Boolean).join(', ');
}

/** The record's slug, its external id; undefined when it has none. */
function slugOf(raw: unknown): string | undefined {
  const slug = (raw as { slug?: unknown } | null)?.slug;
  return typeof slug === 'string' && slug.trim() ? slug.trim() : undefined;
}

/** The Kyiv dates the import may ask ArtWizard for: the catalog window's first 28, both ends included. */
function permittedWindow(now: Date): { from: string; to: string } {
  const { from } = catalogWindow(now);
  return { from, to: addDays(from, DAYS_AHEAD) };
}

/**
 * An occurrence without opening hours: ArtWizard writes 00:00 as the start when the organizer gave no time, and
 * an exhibition's run as 00:00 to 23:59:59 of its last day.
 */
function untimed({ date_from }: Occurrence): boolean {
  return date_from.slice(11, 19) === '00:00:00';
}

/**
 * Whether the catalog shows the occurrence: one with a time when it starts on a window date, one without when its
 * run touches the window. The digits are Kyiv dates, so they are compared as written.
 */
function occurrenceInWindow(occurrence: Occurrence, window: { from: string; to: string }): boolean {
  const from = occurrence.date_from.slice(0, 10);
  const to = occurrence.date_to.slice(0, 10);
  return untimed(occurrence) ? from <= window.to && to >= window.from : from >= window.from && from <= window.to;
}

/** The text of a Quill Delta (`[{"insert":"..."}]`), the format ArtWizard stores descriptions in; plain text as is. */
export function quillText(description: string): string {
  try {
    const delta: unknown = JSON.parse(description);
    const ops = Array.isArray(delta) ? delta : (delta as { ops?: unknown })?.ops;
    if (Array.isArray(ops)) {
      return ops.map((op: { insert?: unknown }) => (typeof op?.insert === 'string' ? op.insert : '')).join('');
    }
  } catch {
    // Not JSON: the description is plain text.
  }
  return description;
}
