// Written with the help of Claude
import { z } from 'zod';
import { EventProvider } from '../../core/import/adapters/event-provider.ts';
import { kyivEndOfDay } from '../../core/common/kyiv-time.ts';
import type { NormalizeResult } from '../../core/import/types/import.ts';
import { concertUaSampleFeed } from './concert-ua-sample-feed.ts';

/** Concert.ua genres we take, and our category each one goes to. */
const CATEGORY_BY_GENRE: Record<string, string> = {
  concert: 'Concerts',
  festival: 'Concerts',
  exhibition: 'Exhibitions',
};

/** Limits of our API's event schema: the catalog answers 500 for an event outside them. */
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;

const RawConcertUaEvent = z.object({
  id: z.union([z.string().trim().min(1), z.number()]).transform(String),
  title: z.string().trim().min(1),
  description: z.string().trim().default(''),
  genre: z.string().trim().min(1),
  venue: z.object({
    name: z.string().trim().min(1),
    address: z.string().trim().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }).optional(),
});

/**
 * Concert.ua behind the EventProvider port (FLEX-003). Where the records come from is `loadFeed`, the sample feed
 * until the service gives us access; replacing it changes nothing outside this file.
 */
export class ConcertUaEventProvider extends EventProvider {
  readonly id = 'concert_ua';

  constructor(private readonly loadFeed: () => Promise<unknown[]> = () => Promise.resolve(concertUaSampleFeed())) {
    super();
  }

  fetch(): Promise<unknown[]> {
    return this.loadFeed();
  }

  normalize(raw: unknown): NormalizeResult {
    const parsed = RawConcertUaEvent.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        skip: { externalId: externalIdOf(raw), reason: `Invalid record: ${issue?.path.join('.') || 'record'}` },
      };
    }
    const { id, title, description, genre, venue, startsAt, endsAt } = parsed.data;
    const categoryName = CATEGORY_BY_GENRE[genre.toLowerCase()];
    if (!categoryName) {
      return { skip: { externalId: id, reason: `Genre "${genre}" has no category` } };
    }
    const start = new Date(startsAt);
    return {
      event: {
        externalId: id,
        title: truncate(title, TITLE_MAX),
        description: truncate(description, DESCRIPTION_MAX),
        categoryName,
        venue: { name: venue.name, address: venue.address, location: { lat: venue.lat, lng: venue.lng } },
        startsAt: start.toISOString(),
        // With no end from the provider, the event lasts until the end of its day in Kyiv (data-model.md).
        endsAt: (endsAt ? new Date(endsAt) : kyivEndOfDay(start)).toISOString(),
      },
    };
  }
}

function externalIdOf(raw: unknown): string | null {
  const id = typeof raw === 'object' && raw !== null && 'id' in raw ? raw.id : undefined;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
