// Written with the help of Claude
import { Logger } from '@nestjs/common';
import { load } from 'cheerio';
import { z } from 'zod';
import { catalogWindow } from '../../core/common/catalog-window.ts';
import { fromKyivWallClock, kyivEndOfDay } from '../../core/common/kyiv-time.ts';
import { EventProvider } from '../../core/import/adapters/event-provider.ts';
import type { NormalizeResult } from '../../core/import/types/import.ts';
import type { HttpClient } from './http-client.ts';
import { errorMessage, fitDescription, fitTitle, jsonLdObjects, slugOf } from './provider-pages.ts';

export const ARTWIZARD_BASE_URL = 'https://artwizard.io';

/** ArtWizard's event types (the page's `type` tags), and our category for each; the first known tag wins. */
const CATEGORY_BY_TAG = new Map([
  ['Музика', 'Concerts'],
  ['Виставки', 'Exhibitions'],
  ['Дискусії та лекції', 'Talks'],
  ['Література', 'Talks'],
  ['Майстер-класи', 'Workshops'],
  ['Кіно', 'Cinema'],
  ['Театр', 'Theatre'],
  ['Гумор', 'Stand-up'],
  ['Фестивалі', 'Festivals'],
  ['Вечірки', 'Parties'],
]);

/** A Kyiv event page: `/kyiv/e/<slug>-YYYYMMDD`. */
const KYIV_EVENT_PATH = /^\/kyiv\/e\/[^/]+-(\d{4})(\d{2})(\d{2})$/;

/** What `fetch` returns for one event page: its Event JSON-LD and type tags, or why the page could not be read. */
export type ArtWizardRecord =
  { url: string; event: Record<string, unknown> | null; types: string[] } | { url: string; error: string };

const RawEvent = z.object({
  name: z.string().trim().min(1),
  description: z.string().default(''),
  url: z.string().optional(),
  image: z.union([z.array(z.string()), z.string()]).optional(),
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }).optional(),
  location: z.object({
    name: z.string().trim().min(1),
    address: z
      .object({ streetAddress: z.string().trim().optional(), addressLocality: z.string().trim().optional() })
      .optional(),
    geo: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional(),
  }),
});

export interface ArtWizardOptions {
  http: HttpClient;
  baseUrl?: string;
  now?: () => Date;
}

/**
 * ArtWizard (artwizard.io) behind the EventProvider port. The sitemap lists the event pages; each page carries a
 * schema.org `Event` in JSON-LD. robots.txt disallows `/api/` and the image CDN, so neither is requested.
 */
export class ArtWizardEventProvider extends EventProvider {
  readonly id = 'artwizard';
  private readonly logger = new Logger(ArtWizardEventProvider.name);
  private readonly http: HttpClient;
  private readonly baseUrl: string;
  private readonly now: () => Date;

  constructor({ http, baseUrl = ARTWIZARD_BASE_URL, now = () => new Date() }: ArtWizardOptions) {
    super();
    this.http = http;
    this.baseUrl = baseUrl;
    this.now = now;
  }

  async fetch(since?: Date): Promise<ArtWizardRecord[]> {
    const sitemapUrl = new URL('/sitemaps/events.xml', this.baseUrl).href;
    const sitemap = await this.http.get(sitemapUrl);
    if (sitemap.status !== 200) {
      throw new Error(`GET ${sitemapUrl} answered ${sitemap.status}`);
    }
    const window = catalogWindow(this.now());
    const pages = sitemapEntries(sitemap.text).filter(({ path }) => {
      const [, year, month, day] = KYIV_EVENT_PATH.exec(path) ?? [];
      const date = `${year}-${month}-${day}`;
      return year !== undefined && date >= window.from && date <= window.to;
    });
    const changed = since ? pages.filter(({ lastmod }) => lastmod && lastmod >= since).length : pages.length;
    this.logger.log(
      `${pages.length} Kyiv event pages from ${window.from} to ${window.to}; ` +
        `${changed} changed since ${since?.toISOString() ?? 'the first run'}`,
    );

    const records: ArtWizardRecord[] = [];
    for (const { path } of pages) {
      records.push(await this.fetchPage(new URL(path, this.baseUrl).href));
    }
    return records;
  }

  private async fetchPage(url: string): Promise<ArtWizardRecord> {
    try {
      const response = await this.http.get(url);
      if (response.status !== 200) {
        return { url, error: `The page answered ${response.status}` };
      }
      if (/<html[^>]*\bid="__next_error__"/.test(response.text)) {
        return { url, error: 'The site could not render the page (Next.js error page)' };
      }
      const event = jsonLdObjects(response.text).find((object) => object['@type'] === 'Event') ?? null;
      return { url, event, types: typeTags(response.text, slugOf(url)) };
    } catch (error) {
      this.logger.warn(`GET ${url} failed: ${errorMessage(error)}`);
      return { url, error: `The page could not be fetched: ${errorMessage(error)}` };
    }
  }

  normalize(raw: unknown): NormalizeResult {
    const record = raw as ArtWizardRecord;
    const externalId = typeof record?.url === 'string' ? slugOf(record.url) || null : null;
    if (!externalId) {
      return { skip: { externalId: null, reason: 'Invalid record: url' } };
    }
    if ('error' in record) {
      return { skip: { externalId, reason: record.error } };
    }
    if (!record.event) {
      return { skip: { externalId, reason: 'The page has no Event JSON-LD' } };
    }
    const parsed = RawEvent.safeParse(record.event);
    if (!parsed.success) {
      return { skip: { externalId, reason: `Invalid record: ${parsed.error.issues[0]?.path.join('.') || 'event'}` } };
    }
    const categoryName = record.types.map((type) => CATEGORY_BY_TAG.get(type)).find(Boolean);
    if (!categoryName) {
      return { skip: { externalId, reason: `No category for the types ${JSON.stringify(record.types)}` } };
    }
    const { name, description, url, image, startDate, endDate, location } = parsed.data;
    // ArtWizard shows 00:00 when the organizer gave no time; a midnight start would also move the matching rounds.
    if (startDate.slice(11, 19) === '00:00:00') {
      return { skip: { externalId, reason: 'No start time (00:00 on ArtWizard)' } };
    }
    // The JSON-LD writes Kyiv time with a `Z`: 19:00 on the page is `19:00:00.000Z`.
    const start = fromKyivWallClock(startDate);
    const end = endDate ? fromKyivWallClock(endDate) : undefined;
    const address = [location.address?.streetAddress, location.address?.addressLocality].filter(Boolean).join(', ');
    return {
      event: {
        externalId,
        title: fitTitle(name),
        description: fitDescription(quillText(description)),
        categoryName,
        venue: {
          name: location.name,
          address,
          location: location.geo ? { lat: location.geo.latitude, lng: location.geo.longitude } : null,
        },
        startsAt: start.toISOString(),
        // An end that is not after the start means the page gives none: the event lasts until the end of its day.
        endsAt: (end && end > start ? end : kyivEndOfDay(start)).toISOString(),
        imageUrl: (Array.isArray(image) ? image[0] : image) ?? null,
        sourceUrl: url ?? record.url,
      },
    };
  }
}

function sitemapEntries(xml: string): { path: string; lastmod: Date | undefined }[] {
  const $ = load(xml, { xml: true });
  return $('url')
    .toArray()
    .flatMap((entry) => {
      const loc = $(entry).find('loc').text().trim();
      const lastmod = $(entry).find('lastmod').text().trim();
      try {
        return [{ path: new URL(loc).pathname, lastmod: lastmod ? new Date(lastmod) : undefined }];
      } catch {
        return [];
      }
    });
}

/**
 * The event's type tags. They are not in the JSON-LD, only in the page's Next.js data, where the event object
 * reads `\"type\":[\"Театр\",...],\"tags\":[{...,\"slug\":\"16\"}],\"slug\":\"<slug>\"`: the list just before
 * the event's own slug. The tags can be objects, so the search goes back from the slug.
 */
function typeTags(html: string, slug: string): string[] {
  const marker = `\\"slug\\":\\"${slug}\\"`;
  for (let at = html.indexOf(marker); at !== -1; at = html.indexOf(marker, at + marker.length)) {
    const before = html.slice(Math.max(0, at - 4000), at);
    const list = [...before.matchAll(/\\"type\\":\[([^\]]*)\],\\"tags\\":/g)].at(-1)?.[1];
    if (list !== undefined) {
      return [...list.matchAll(/\\"((?:[^"\\]|\\[^"])*)\\"/g)].map(([, tag]) => tag ?? '');
    }
  }
  return [];
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
