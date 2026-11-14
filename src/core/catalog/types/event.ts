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
   * False for an imported event whose provider gives no end: `endsAt` is then the end of its start day in
   * Europe/Kyiv. Always true for an organization's event.
   */
  endTimeKnown: boolean;
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
