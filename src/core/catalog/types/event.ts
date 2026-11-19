// Written with the help of Claude
import type { Category } from './category.ts';
import type { Venue } from './venue.ts';

export type EventSource = 'organization' | 'import';

export type EventStatus = 'published' | 'cancelled';

export interface Event {
  id: string;
  title: string;
  description: string;
  category: Pick<Category, 'id' | 'name'>;
  venue: Venue;
  startsAt: string;
  endsAt: string;
  /**
   * False for an imported event whose provider gives no time of day, such as an exhibition run without opening hours:
   * `startsAt` is then a default opening time that only orders the event and its sessions. Always true for an
   * organization's event.
   */
  startTimeKnown: boolean;
  /**
   * False for an imported event whose provider gives no end: `endsAt` is then the end of its start day in
   * Europe/Kyiv. Always true for an organization's event.
   */
  endTimeKnown: boolean;
  /** The lowest ticket price in whole hryvnias; null when unknown, 0 when the event is free or starts from free. */
  priceMin: number | null;
  /** The highest price of a range in whole hryvnias; null for one price, a free event or an unknown price. */
  priceMax: number | null;
  /** Set on imported events: the provider's image, linked, never copied. */
  imageUrl: string | null;
  /** Set on imported events: the event's page at the provider, for attribution and tickets. */
  sourceUrl: string | null;
  source: EventSource;
  status: EventStatus;
  organizationId: string | null;
}

export interface EventFilter {
  categoryId?: string;
  venueId?: string;
  from: string;
  to: string;
}

export type EventQuery = Partial<EventFilter>;

export interface NewEvent {
  title: string;
  description: string;
  categoryId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
}

export type EventChanges = Partial<NewEvent>;

export type EventRecord = NewEvent & Pick<Event, 'source' | 'status' | 'organizationId'>;
