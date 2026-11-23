// Written with the help of Claude
import type { WholeImageRef } from '../../images/types/image.ts';
import type { Category } from './category.ts';
import type { OrganizationName } from './organization.ts';
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
  /** Set on imported events: the provider's image, linked, never copied. */
  imageUrl: string | null;
  /** The cover an organization uploaded for its event; null for imported events. */
  photoId: string | null;
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

/** An event as the API returns it: with its cover's size and crop. */
export type WithPhoto<T extends Event> = T & { photo: WholeImageRef | null };

/** An event as the admin panel shows it, in any status, with the organization that added it. */
export interface EventOverview extends Event {
  organization: OrganizationName | null;
}

/**
 * Which events the admin panel lists; `search` matches part of the title, in any case. `upcoming`: not ended yet,
 * soonest first; `past`: ended, latest first.
 */
export interface EventSearch {
  period: 'upcoming' | 'past';
  search?: string;
  source?: EventSource;
  status?: EventStatus;
  organizationId?: string;
  venueId?: string;
  categoryId?: string;
}

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
