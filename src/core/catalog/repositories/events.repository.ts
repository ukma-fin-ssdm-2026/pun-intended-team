// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type { Transaction } from '../../common/transaction.ts';
import type {
  Event,
  EventChanges,
  EventFilter,
  EventOverview,
  EventRecord,
  EventSearch,
  EventStatus,
} from '../types/event.ts';

/**
 * What the catalog needs from storage. Core only depends on this class;
 * InfraModule decides which implementation services get.
 */
export abstract class EventsRepository {
  abstract findById(id: string, tx?: Transaction): Promise<Event | undefined>;

  /** Published events that overlap the filter's dates and match all its other fields, soonest first. */
  abstract findPublished(filter: EventFilter, page: PageRequest): Promise<Page<Event>>;

  /** The organization's events that end after the instant, in any status or only in `status`; soonest first. */
  abstract findByOrganization(
    organizationId: string,
    endingAfter: Date,
    page: PageRequest,
    status?: EventStatus,
  ): Promise<Page<Event>>;

  /** Events in any status that match, in the order of the filter's period; `now` splits upcoming from past. */
  abstract search(filter: EventSearch, now: Date, page: PageRequest): Promise<Page<EventOverview>>;

  abstract findOverview(id: string): Promise<EventOverview | undefined>;

  /** Published events that end after the instant. */
  abstract countPublishedEndingAfter(instant: Date): Promise<number>;

  abstract create(event: EventRecord): Promise<Event>;

  abstract update(id: string, changes: EventChanges & { status?: EventStatus }, tx?: Transaction): Promise<Event>;

  abstract setPhoto(id: string, photoId: string | null, tx?: Transaction): Promise<Event>;
}
