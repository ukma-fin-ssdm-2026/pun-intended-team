// Written with the help of Claude
import { Logger } from '@nestjs/common';
import { load } from 'cheerio';
import { z } from 'zod';
import { catalogWindow } from '../../core/common/catalog-window.ts';
import { MINUTE_MS } from '../../core/common/durations.ts';
import { addDays, fromKyivWallClock, kyivDate, kyivEndOfDay, toKyivWallClock } from '../../core/common/kyiv-time.ts';
import { EventProvider } from '../../core/import/adapters/event-provider.ts';
import type { FetchResult, NormalizeResult } from '../../core/import/types/import.ts';
import type { HttpClient } from './http-client.ts';
import {
  coveredInstants,
  errorMessage,
  fitDescription,
  fitTitle,
  inWindow,
  jsonLdObjects,
  slugOf,
} from './provider-pages.ts';

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

/**
 * The Kyiv section pages we read, in order, and the slug of our category for each; the section decides, not
 * `@type`. A section with `types` takes only events of those `@type`s and skips the others: `/clubs/` also lists
 * talks, board-game nights and wine tastings as plain `Event`, which are not parties (ADR-006).
 */
export const KARABAS_SECTIONS: { path: string; categorySlug: string; types?: string[] }[] = [
  { path: '/concerts/', categorySlug: 'concerts' },
  { path: '/exhibitions/', categorySlug: 'exhibitions' },
  { path: '/cinema/', categorySlug: 'cinema' },
  { path: '/theatres/', categorySlug: 'theatre' },
  { path: '/sport/', categorySlug: 'sports' },
  { path: '/festivals/', categorySlug: 'festivals' },
  { path: '/clubs/', categorySlug: 'parties', types: ['MusicEvent'] },
];

/** One event as `fetch` returns it: its JSON-LD from a section page, and the slug of that section's category. */
export interface KarabasRecord {
  section: string;
  categorySlug: string;
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
    const now = this.now();
    const window = catalogWindow(now);
    const byUrl = new Map<string, KarabasRecord>();
    const read = { pages: 0, outsideWindow: 0 };
    // Events in the window per section, before an event listed in two sections is kept once.
    const parts = new Map<string, number>();
    let failedSections = 0;
    let incompleteSections = 0;

    for (const section of KARABAS_SECTIONS) {
      const result = await this.readSection(section, window, byUrl, read, parts);
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
    return {
      records: [...byUrl.values()],
      complete: failedSections === 0 && incompleteSections === 0,
      covers: coveredInstants(now, window),
      parts: Object.fromEntries(parts),
    };
  }

  /**
   * One section's pages into `byUrl`. `failed` when its first page cannot be read, `incomplete` when a later one
   * cannot, or when the reading stops early: at the page limit, on a page that repeats the earlier ones, or at a
   * "load more" link that leads out of the section.
   */
  private async readSection(
    { path, categorySlug }: { path: string; categorySlug: string },
    window: { from: string; to: string },
    byUrl: Map<string, KarabasRecord>,
    read: { pages: number; outsideWindow: number },
    parts: Map<string, number>,
  ): Promise<'complete' | 'incomplete' | 'failed'> {
    const sectionUrl = new URL(path, this.baseUrl);
    const seenInSection = new Set<string>();
    const inWindowInSection = new Set<string>();
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
      parts.set(path, inWindowInSection.size);

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
        if (!inWindowInSection.has(key)) {
          inWindowInSection.add(key);
          parts.set(path, inWindowInSection.size);
        }
        if (!byUrl.has(key)) {
          byUrl.set(key, { section: path, categorySlug, event });
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
    const types = KARABAS_SECTIONS.find(({ path }) => path === record.section)?.types;
    const type = record.event['@type'];
    if (types && !types.includes(String(type))) {
      return {
        skip: {
          externalId: slugOf(url),
          reason: `@type ${JSON.stringify(type)} on ${record.section}, which takes only ${types.join(', ')}`,
        },
      };
    }
    const start = karabasStart(startDate);
    // The length is read from the description as the page gives it, before it is cut to our limit.
    const end = karabasEnd(start, endDate, durationFromDescription(description));
    if (end.runUntil) {
      const until = end.runEndTime ? `${end.runUntil} at ${end.runEndTime}` : end.runUntil;
      this.logger.log(`${slugOf(url)}: a run of shows until ${until}; importing the first show only`);
    }
    const address = [location.address.streetAddress, location.address.addressLocality].filter(Boolean).join(', ');
    return {
      event: {
        externalId: slugOf(url),
        title: fitTitle(name),
        description: fitDescription(description),
        categorySlug: record.categorySlug,
        venue: { name: location.name, address, location: null },
        startsAt: start.toISOString(),
        endsAt: end.endsAt.toISOString(),
        endTimeKnown: end.endTimeKnown,
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

/** The end of a Karabas event, and whether Karabas gives one (ADR-006, decision 5). */
export interface KarabasEnd {
  endsAt: Date;
  /** False when neither the `endDate` nor a length gives an end: `endsAt` is then the end of the start day. */
  endTimeKnown: boolean;
  /** The last Kyiv date of a run of shows, of which `endsAt` ends the first. */
  runUntil?: string;
  /** The time of day, HH:MM in Kyiv, each show of the run ends at, when the `endDate` gives one. */
  runEndTime?: string;
}

/**
 * The end of an event from its `endDate`, or else from the length its description gives, in minutes. A midnight is
 * written without the shift of `startDate`: the next midnight means no end is given, a later one a run of shows from
 * the start date to the day before it. Any other time is shifted like the start: later the same day it is the end,
 * and on a later day it ends a run of shows, daily from the start time to that time of day. Of a run only the first
 * show is imported (ADR-006).
 */
export function karabasEnd(start: Date, endDate: string | undefined, durationMinutes?: number): KarabasEnd {
  const startDay = kyivDate(start);
  const fromLength = (): Pick<KarabasEnd, 'endsAt' | 'endTimeKnown'> => {
    const end = durationMinutes === undefined ? undefined : new Date(start.getTime() + durationMinutes * MINUTE_MS);
    // A 23:00 show of 2 hours would end after midnight: the length may be of the programme and not of that night,
    // so only an end on the start day is taken.
    return end && end > start && kyivDate(end) === startDay
      ? { endsAt: end, endTimeKnown: true }
      : { endsAt: kyivEndOfDay(start), endTimeKnown: false };
  };
  if (!endDate) {
    return fromLength();
  }
  if (endDate.slice(11, 19) === '00:00:00') {
    const lastDay = addDays(endDate.slice(0, 10), -1);
    return lastDay > startDay ? { ...fromLength(), runUntil: lastDay } : fromLength();
  }
  const end = karabasStart(endDate);
  if (!(end > start)) {
    return fromLength();
  }
  const endDay = kyivDate(end);
  if (endDay === startDay) {
    return { endsAt: end, endTimeKnown: true };
  }
  // The end time of day on the start day: the wall-clock digits of the start day with the time of the end.
  const runEndTime = toKyivWallClock(end).toISOString().slice(11, 16);
  const firstEnd = fromKyivWallClock(`${startDay}T${runEndTime}:00Z`);
  // An end time that is not after the start time of day (21:00 to 02:00 on a later day) is no daily run.
  return firstEnd > start ? { endsAt: firstEnd, endTimeKnown: true, runUntil: endDay, runEndTime } : fromLength();
}

const LOWER_CASE = 'а-яіїєґ';
/** "год", "год.", "година", "години", "годин", and the same for minutes; not the start of a longer word. */
const HOURS = `год(?:ин[аи]?|\\.)?(?![${LOWER_CASE}])`;
const MINUTES = `хв(?:илин[аи]?|\\.)?(?![${LOWER_CASE}])`;
/**
 * A length right after the word "тривалість", with at most 40 characters without a digit or the end of a sentence
 * in between ("Тривалість вистави – "): hours and minutes, tenths of an hour, hours alone, or minutes alone.
 */
const LENGTH = new RegExp(
  `[Тт]ривалість([^\\d.!?]{0,40}?)(?:` +
    `(\\d{1,2})\\s*${HOURS}\\s*(\\d{1,2})\\s*${MINUTES}|` +
    `(\\d{1,2})[.,](\\d)\\s*${HOURS}|` +
    `(\\d{1,2})\\s*${HOURS}|` +
    `(\\d{1,3})\\s*${MINUTES})`,
);
/** Words before the number that make it a bound and not a length: "від 1 години", "до 60 хвилин". */
const BOUND = new RegExp(`(?:^|[^${LOWER_CASE}])(?:від|до|понад|близько)(?:[^${LOWER_CASE}]|$)`, 'i');
const SHORTEST_MINUTES = 10;
const LONGEST_MINUTES = 12 * 60;

/**
 * The length of an event in minutes, when its description states one: "Тривалість вистави – 1 год 20 хв" is 80,
 * "тривалість: 90 хв" 90, "Тривалість: 1,5 години" 90. Read conservatively (ADR-006, decision 5): only the first
 * length right after the word "тривалість", from 10 minutes to 12 hours; undefined otherwise, also for a bound
 * ("від 1 години"). A note such as "без антракту" is not a length.
 */
export function durationFromDescription(text: string): number | undefined {
  const match = LENGTH.exec(text);
  if (!match) {
    return undefined;
  }
  const [, between, hours, andMinutes, wholeHours, tenths, onlyHours, onlyMinutes] = match;
  if (BOUND.test(between ?? '')) {
    return undefined;
  }
  let minutes: number;
  if (hours !== undefined) {
    if (Number(andMinutes) >= 60) {
      return undefined;
    }
    minutes = Number(hours) * 60 + Number(andMinutes);
  } else if (wholeHours !== undefined) {
    minutes = Number(wholeHours) * 60 + Number(tenths) * 6;
  } else if (onlyHours !== undefined) {
    minutes = Number(onlyHours) * 60;
  } else {
    minutes = Number(onlyMinutes);
  }
  return minutes >= SHORTEST_MINUTES && minutes <= LONGEST_MINUTES ? minutes : undefined;
}
