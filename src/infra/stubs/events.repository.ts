// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from '../../core/catalog/repositories/categories.repository.ts';
import { EventsRepository } from '../../core/catalog/repositories/events.repository.ts';
import type { Category } from '../../core/catalog/types/category.ts';
import type { Event, EventChanges, EventFilter, EventRecord, EventStatus } from '../../core/catalog/types/event.ts';
import type { ImportedEventRecord } from '../../core/catalog/types/import.ts';
import { kyivDate } from '../../core/common/kyiv-time.ts';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { events, type StoredEvent, venues } from './data.ts';
import { paginate } from './paginate.ts';

@Injectable()
export class StubEventsRepository implements EventsRepository {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findById(id: string): Promise<Event | undefined> {
    const event = events.find((event) => event.id === id);
    return event && toEvent(event, await this.categoriesById());
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
    const categories = await this.categoriesById();
    return paginate(
      matching.map((event) => toEvent(event, categories)),
      page,
    );
  }

  async create(record: EventRecord): Promise<Event> {
    const event: StoredEvent = { id: randomUUID(), ...record };
    events.push(event);
    return toEvent(event, await this.categoriesById());
  }

  async findByExternalId(provider: string, externalId: string): Promise<Event | undefined> {
    const event = events.find((event) => event.provider === provider && event.externalId === externalId);
    return event && toEvent(event, await this.categoriesById());
  }

  async createImported(record: ImportedEventRecord): Promise<Event> {
    const event: StoredEvent = { id: randomUUID(), ...record };
    events.push(event);
    return toEvent(event, await this.categoriesById());
  }

  async update(id: string, changes: EventChanges & { status?: EventStatus }): Promise<Event> {
    const event = events.find((event) => event.id === id);
    if (!event) {
      throw new Error(`No event ${id} to update`);
    }
    Object.assign(event, changes);
    return toEvent(event, await this.categoriesById());
  }

  // Stands in for the join with the categories table.
  private async categoriesById(): Promise<Map<string, Category>> {
    return new Map((await this.categoriesRepository.findAll()).map((category) => [category.id, category]));
  }
}

function toEvent(
  { categoryId, venueId, provider: _provider, externalId: _externalId, ...event }: StoredEvent,
  categories: Map<string, Category>,
): Event {
  const category = categories.get(categoryId);
  if (!category) {
    throw new Error(`No category ${categoryId} for event ${event.id}`);
  }
  const venue = venues.find((venue) => venue.id === venueId)!;
  return { ...event, category: { id: category.id, name: category.name }, venue };
}
