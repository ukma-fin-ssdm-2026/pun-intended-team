// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { addDays, kyivDate } from '../../common/kyiv-time.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { EventsRepository } from '../repositories/events.repository.ts';
import { OrganizationsRepository } from '../repositories/organizations.repository.ts';
import { VenuesRepository } from '../repositories/venues.repository.ts';
import type { Event, EventQuery, NewEvent } from '../types/event.ts';
import { CategoriesService } from './categories.service.ts';

const CATALOG_WINDOW_DAYS = 28;

@Injectable()
export class EventsService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly venuesRepository: VenuesRepository,
    private readonly categoriesService: CategoriesService,
  ) {}

  async stats(): Promise<{ events: number }> {
    return { events: await this.eventsRepository.countPublishedEndingAfter(new Date()) };
  }

  async list(query: EventQuery, page: PageRequest): Promise<Page<Event>> {
    const today = kyivDate();
    const windowEnd = addDays(today, CATALOG_WINDOW_DAYS);
    const from = query.from && query.from > today ? query.from : today;
    const to = query.to && query.to < windowEnd ? query.to : windowEnd;
    return this.eventsRepository.findPublished({ ...query, from, to }, page);
  }

  async find(id: string): Promise<Event | undefined> {
    return this.eventsRepository.findById(id);
  }

  async getById(id: string): Promise<Event> {
    const event = await this.eventsRepository.findById(id);
    if (!event) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    return event;
  }

  async create(accountId: string, input: NewEvent): Promise<Event> {
    await this.requireVerifiedOrganization(accountId);
    await this.checkReferences(accountId, input);
    checkTimes(input.startsAt, input.endsAt);
    return this.eventsRepository.create({
      ...input,
      source: 'organization',
      status: 'published',
      organizationId: accountId,
    });
  }

  /** Replaces every editable field. Anyone but the posting organization is told the event does not exist. */
  async update(accountId: string, id: string, input: NewEvent): Promise<Event> {
    const event = await this.getOwned(accountId, id);
    await this.requireVerifiedOrganization(accountId);
    if (event.status === 'cancelled') {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event can no longer be edited');
    }
    await this.checkReferences(accountId, input);
    checkTimes(input.startsAt, input.endsAt);
    return this.eventsRepository.update(id, input);
  }

  async cancel(accountId: string, id: string): Promise<Event> {
    const event = await this.getOwned(accountId, id);
    if (event.status === 'cancelled') {
      return event;
    }
    return this.eventsRepository.update(id, { status: 'cancelled' });
  }

  private async getOwned(accountId: string, id: string): Promise<Event> {
    const event = await this.getById(id);
    if (event.organizationId !== accountId) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    return event;
  }

  private async requireVerifiedOrganization(accountId: string): Promise<void> {
    const organization = await this.organizationsRepository.findByAccountId(accountId);
    if (organization?.verificationStatus !== 'verified') {
      throw new DomainError('ORGANIZATION_NOT_VERIFIED', 'Only a verified organization can publish events');
    }
  }

  private async checkReferences(accountId: string, { categoryId, venueId }: NewEvent): Promise<void> {
    if (!(await this.categoriesService.findActive(categoryId))) {
      throw new DomainError('REFERENCE_NOT_FOUND', 'Category not found');
    }
    const venue = await this.venuesRepository.findById(venueId);
    if (!venue || venue.organizationId !== accountId) {
      throw new DomainError('REFERENCE_NOT_FOUND', 'Venue not found');
    }
  }
}

function checkTimes(startsAt: string, endsAt: string): void {
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new DomainError('EVENT_ENDS_BEFORE_START', 'The event must end after it starts');
  }
}
