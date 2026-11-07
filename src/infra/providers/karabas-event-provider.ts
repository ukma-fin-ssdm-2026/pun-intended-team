// Written with the help of Claude
import { Logger } from '@nestjs/common';
import { load } from 'cheerio';
import { z } from 'zod';
import { catalogWindow } from '../../core/common/catalog-window.ts';
import { addDays, fromKyivWallClock, kyivDate, kyivEndOfDay } from '../../core/common/kyiv-time.ts';
import { EventProvider } from '../../core/import/adapters/event-provider.ts';
import type { FetchResult, NormalizeResult } from '../../core/import/types/import.ts';
import type { HttpClient } from './http-client.ts';
import { errorMessage, fitDescription, fitTitle, inWindow, jsonLdObjects, slugOf } from './provider-pages.ts';

export const KARABAS_BASE_URL = 'https://kyiv.karabas.com';

/**
 * A stop per section. On 2026-11-07 the 28 days of the window took 10 pages of 20 on `/concerts/`, and about 30 on
 * `/theatres/`, which lists some 20 shows a day.
 */
export const MAX_PAGES_PER_SECTION = 40;
/**
 * Events per page. The "load more" link in the HTML leaves it out, and without it page 2 answers 100 events from
 * two weeks later, skipping the days between; the site's own button adds it.
 */
const PER_PAGE = '20';

/** The Kyiv section pages we read, in order, and our category for each; the section decides, not `@type`. */
export const KARABAS_SECTIONS: { path: string; category: string }[] = [
  { path: '/concerts/', category: 'Concerts' },
  { path: '/exhibitions/', category: 'Exhibitions' },
  { path: '/cinema/', category: 'Cinema' },
  { path: '/theatres/', category: 'Theatre' },
  { path: '/sport/', category: 'Sports' },
  { path: '/festivals/', category: 'Festivals' },
  { path: '/clubs/', category: 'Parties' },
];

/** One event as `fetch` returns it: its JSON-LD from a section page, and that section's category. */
export interface KarabasRecord {
  section: string;
  category: string;
  event: Record<string, unknown>;
}

const RawEvent = z.object({
  url: z.url(),
  name: z.string().trim().min(1),
  description: z.string().default(''),
  image: z.object({ url: z.string() }).optional(),
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }).optional(),
  location: z.object({
    name: z.string().trim().min(1),
    address: z.object({
      streetAddress: z.string().trim().optional(),
      addressLocality: z.string().trim().optional(),
    }),
  }),
});

export interface KarabasOptions {
  http: HttpClient;
  baseUrl?: string;
  now?: () => Date;
}

/**
 * Karabas (kyiv.karabas.com) behind the EventProvider port. Each section page carries the schema.org JSON-LD of
 * its events with every field we need, so no event page is requested. robots.txt disallows `/ajax.php`.
 */
export class KarabasEventProvider extends EventProvider {
  readonly id = 'karabas';
  private readonly logger = new Logger(KarabasEventProvider.name);
  private readonly http: HttpClient;
  private readonly baseUrl: string;
  private readonly now: () => Date;

  constructor({ http, baseUrl = KARABAS_BASE_URL, now = () => new Date() }: KarabasOptions) {
    super();
    this.http = http;
    this.baseUrl = baseUrl;
    this.now = now;
  }

  /**
   * Every section, page after page, until a page reaches past the window or has no "load more" link. The list is
   * complete only when every section was read to that point.
   */
  async fetch(): Promise<FetchResult<KarabasRecord>> {
    const window = catalogWindow(this.now());
    const byUrl = new Map<string, KarabasRecord>();
    const read = { pages: 0, outsideWindow: 0 };
    let failedSections = 0;
    let incompleteSections = 0;

    for (const section of KARABAS_SECTIONS) {
      const result = await this.readSection(section, window, byUrl, read);
      if (result === 'failed') {
        failedSections++;
      } else if (result === 'incomplete') {
        incompleteSections++;
      }
    }
    if (failedSections === KARABAS_SECTIONS.length) {
      throw new Error('No Karabas section page could be fetched');
    }
    this.logger.log(
      `${byUrl.size} events from ${window.from} to ${window.to} in ${read.pages} pages; ` +
        `${read.outsideWindow} outside it; ${failedSections} of ${KARABAS_SECTIONS.length} sections failed, ` +
        `${incompleteSections} not read to the end`,
    );
    return { records: [...byUrl.values()], complete: failedSections === 0 && incompleteSections === 0 };
  }

  /**
   * One section's pages into `byUrl`. `failed` when its first page cannot be read, `incomplete` when a later one
   * cannot, or when the reading stops early: at the page limit, on a page that repeats the earlier ones, or at a
   * "load more" link that leads out of the section.
   */
  private async readSection(
    { path, category }: { path: string; category: string },
    window: { from: string; to: string },
    byUrl: Map<string, KarabasRecord>,
    read: { pages: number; outsideWindow: number },
  ): Promise<'complete' | 'incomplete' | 'failed'> {
    const sectionUrl = new URL(path, this.baseUrl);
    const seenInSection = new Set<string>();
    let url = sectionUrl.href;
    for (let page = 1; ; page++) {
      if (page > MAX_PAGES_PER_SECTION) {
        this.logger.warn(`${path}: stopped after ${MAX_PAGES_PER_SECTION} pages, before the end of the window`);
        return 'incomplete';
      }
      let html: string;
      try {
        const response = await this.http.get(url);
        if (response.status !== 200) {
          throw new Error(`answered ${response.status}`);
        }
        html = response.text;
      } catch (error) {
        this.logger.warn(`GET ${url} failed: ${errorMessage(error)}`);
        return page === 1 ? 'failed' : 'incomplete';
      }
      read.pages++;

      const events = jsonLdObjects(html).filter(isEvent);
      let newInSection = 0;
      // The start of the page's last event, the one the next page is counted from (`time` in its link). Not the
      // latest start on the page: an event pinned to the top of a page could start long after the others.
      let lastStart: Date | undefined;
      for (const event of events) {
        const start = typeof event.startDate === 'string' ? karabasStart(event.startDate) : undefined;
        const validStart = start && !Number.isNaN(start.getTime()) ? start : undefined;
        lastStart = validStart ?? lastStart;
        // The same event is listed in several sections; the first one decides its category.
        const key = typeof event.url === 'string' ? event.url : JSON.stringify(event);
        if (!seenInSection.has(key)) {
          seenInSection.add(key);
          newInSection++;
        }
        if (validStart && !inWindow(validStart, window)) {
          read.outsideWindow++;
          continue;
        }
        if (!byUrl.has(key)) {
          byUrl.set(key, { section: path, category, event });
        }
      }

      if (events.length === 0 || (lastStart && kyivDate(lastStart) > window.to)) {
        return 'complete';
      }
      if (page > 1 && newInSection === 0) {
        this.logger.warn(`${path}: page ${page} repeats the earlier pages; stopped`);
        return 'incomplete';
      }
      const next = nextPage(html, sectionUrl);
      if (next === 'last') {
        return 'complete';
      }
      if (next === 'outside') {
        this.logger.warn(`${path}: the "load more" link leads out of the section; stopped`);
        return 'incomplete';
      }
      url = next.url;
    }
  }

  normalize(raw: unknown): NormalizeResult {
    const record = raw as KarabasRecord;
    const parsed = RawEvent.safeParse(record?.event);
    if (!parsed.success) {
      const url = (record?.event as { url?: unknown } | undefined)?.url;
      return {
        skip: {
          externalId: typeof url === 'string' ? slugOf(url) || null : null,
          reason: `Invalid record: ${parsed.error.issues[0]?.path.join('.') || 'event'}`,
        },
      };
    }
    const { url, name, description, image, startDate, endDate, location } = parsed.data;
    const start = karabasStart(startDate);
    const end = karabasEnd(start, endDate);
    if (end.runUntil) {
      this.logger.log(`${slugOf(url)}: a run of shows until ${end.runUntil}; importing the first show only`);
    }
    const address = [location.address.streetAddress, location.address.addressLocality].filter(Boolean).join(', ');
    return {
      event: {
        externalId: slugOf(url),
        title: fitTitle(name),
        description: fitDescription(description),
        categoryName: record.category,
        venue: { name: location.name, address, location: null },
        startsAt: start.toISOString(),
        endsAt: end.endsAt.toISOString(),
        imageUrl: image?.url ?? null,
        sourceUrl: url,
      },
    };
  }
}

/**
 * The section's next page, from the page's "load more" link with `per-page` added; `last` on a page without the
 * link. `outside` for a link to another host or path, which is never followed (robots.txt disallows `/ajax.php`).
 */
export function nextPage(html: string, sectionUrl: URL): { url: string } | 'last' | 'outside' {
  const href = load(html)('a[data-pagination-load-more]').attr('href');
  if (!href) {
    return 'last';
  }
  const next = new URL(href, sectionUrl);
  if (next.origin !== sectionUrl.origin || next.pathname !== sectionUrl.pathname) {
    return 'outside';
  }
  next.searchParams.set('per-page', PER_PAGE);
  return { url: next.href };
}

function isEvent(object: Record<string, unknown>): boolean {
  const type = object['@type'];
  return typeof type === 'string' && /Event$/.test(type) && 'startDate' in object && 'location' in object;
}

/**
 * The JSON-LD shifts times by the offset: 19:00 on the page is `21:00:00+02:00`, i.e. 19:00Z. The UTC digits are
 * the Kyiv wall-clock time.
 */
export function karabasStart(startDate: string): Date {
  return fromKyivWallClock(new Date(startDate));
}

/**
 * The end of an event from its `endDate`. A midnight is written without the shift of `startDate`: the next
 * midnight means no end is given, a later one a run of shows from the start date to the day before it, of which
 * only the first show is imported (ADR-006). Any other time is shifted like the start, and is a real end when it
 * is later the same day; otherwise the event ends with its day.
 */
export function karabasEnd(start: Date, endDate: string | undefined): { endsAt: Date; runUntil?: string } {
  const endOfDay = kyivEndOfDay(start);
  if (!endDate) {
    return { endsAt: endOfDay };
  }
  const startDay = kyivDate(start);
  if (endDate.slice(11, 19) === '00:00:00') {
    const lastDay = addDays(endDate.slice(0, 10), -1);
    return lastDay > startDay ? { endsAt: endOfDay, runUntil: lastDay } : { endsAt: endOfDay };
  }
  const end = karabasStart(endDate);
  return end > start && kyivDate(end) === startDay ? { endsAt: end } : { endsAt: endOfDay };
}
