// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type { Event, EventChanges, EventFilter, EventRecord, EventStatus } from '../types/event.ts';

/**
 * What the catalog needs from storage. Core only depends on this class;
 * InfraModule decides which implementation services get.
 */
export abstract class EventsRepository {
  abstract findById(id: string): Promise<Event | undefined>;

  /** Published events that overlap the filter's dates, soonest first. */
  abstract findPublished(filter: EventFilter, page: PageRequest): Promise<Page<Event>>;

  abstract create(event: EventRecord): Promise<Event>;

  abstract update(id: string, changes: EventChanges & { status?: EventStatus }): Promise<Event>;
}
