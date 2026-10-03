// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventsRepository } from '../../core/catalog/repositories/events.repository.js';
import type { Event, EventChanges, EventFilter, EventRecord, EventStatus } from '../../core/catalog/types/event.js';
import { kyivDate } from '../../core/common/kyiv-time.js';
import type { Page, PageRequest } from '../../core/common/page.js';
import { categories, events, type StoredEvent, venues } from './data.js';
import { paginate } from './paginate.js';

@Injectable()
export class StubEventsRepository implements EventsRepository {
  async findById(id: string): Promise<Event | undefined> {
    const event = events.find((event) => event.id === id);
    return event && toEvent(event);
  }

  async findPublished(filter: EventFilter, page: PageRequest): Promise<Page<Event>> {
    const matching = events
      .filter(
        (event) =>
          event.status === 'published' &&
          (!filter.categoryId || event.categoryId === filter.categoryId) &&
          (!filter.venueId || event.venueId === filter.venueId) &&
          kyivDate(event.endsAt) >= filter.from &&
          kyivDate(event.startsAt) <= filter.to,
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return paginate(matching.map(toEvent), page);
  }

  async create(record: EventRecord): Promise<Event> {
    const event: StoredEvent = { id: randomUUID(), ...record };
    events.push(event);
    return toEvent(event);
  }

  async update(id: string, changes: EventChanges & { status?: EventStatus }): Promise<Event> {
    const event = events.find((event) => event.id === id);
    if (!event) {
      throw new Error(`No event ${id} to update`);
    }
    Object.assign(event, changes);
    return toEvent(event);
  }
}

function toEvent({ categoryId, venueId, ...event }: StoredEvent): Event {
  const category = categories.find((category) => category.id === categoryId)!;
  const venue = venues.find((venue) => venue.id === venueId)!;
  return { ...event, category: { id: category.id, name: category.name }, venue };
}
