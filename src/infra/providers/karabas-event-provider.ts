// Written with the help of Claude
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { catalogWindow } from '../../core/common/catalog-window.ts';
import { addDays, fromKyivWallClock, kyivDate, kyivEndOfDay } from '../../core/common/kyiv-time.ts';
import { EventProvider } from '../../core/import/adapters/event-provider.ts';
import type { NormalizeResult } from '../../core/import/types/import.ts';
import type { HttpClient } from './http-client.ts';
import { errorMessage, fitDescription, fitTitle, inWindow, jsonLdObjects, slugOf } from './provider-pages.ts';

export const KARABAS_BASE_URL = 'https://kyiv.karabas.com';

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

  async fetch(): Promise<KarabasRecord[]> {
    const window = catalogWindow(this.now());
    const byUrl = new Map<string, KarabasRecord>();
    let failedSections = 0;
    let outsideWindow = 0;

    for (const { path, category } of KARABAS_SECTIONS) {
      const url = new URL(path, this.baseUrl).href;
      let events: Record<string, unknown>[];
      try {
        const response = await this.http.get(url);
        if (response.status !== 200) {
          throw new Error(`answered ${response.status}`);
        }
        events = jsonLdObjects(response.text).filter(isEvent);
      } catch (error) {
        failedSections++;
        this.logger.warn(`GET ${url} failed: ${errorMessage(error)}`);
        continue;
      }
      for (const event of events) {
        const start = typeof event.startDate === 'string' ? karabasStart(event.startDate) : undefined;
        if (start && !Number.isNaN(start.getTime()) && !inWindow(start, window)) {
          outsideWindow++;
          continue;
        }
        // The same event is listed in several sections; the first one decides its category.
        const key = typeof event.url === 'string' ? event.url : JSON.stringify(event);
        if (!byUrl.has(key)) {
          byUrl.set(key, { section: path, category, event });
        }
      }
    }
    if (failedSections === KARABAS_SECTIONS.length) {
      throw new Error('No Karabas section page could be fetched');
    }
    this.logger.log(
      `${byUrl.size} events from ${window.from} to ${window.to}; ${outsideWindow} outside it; ` +
        `${failedSections} of ${KARABAS_SECTIONS.length} sections failed`,
    );
    return [...byUrl.values()];
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
