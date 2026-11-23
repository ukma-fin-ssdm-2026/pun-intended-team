// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { catalogWindow } from '../../common/catalog-window.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { ImagesService } from '../../images/services/images.service.ts';
import type { ImageUpload } from '../../images/types/image.ts';
import { JobQueue } from '../../jobs/adapters/job-queue.ts';
import { EVENT_CHANGED_JOB, type EventChange, type EventChangedPayload } from '../../jobs/types/event-changed.ts';
import { EventsRepository } from '../repositories/events.repository.ts';
import { OrganizationsRepository } from '../repositories/organizations.repository.ts';
import { VenuesRepository } from '../repositories/venues.repository.ts';
import type {
  Event,
  EventChanges,
  EventOverview,
  EventQuery,
  EventSearch,
  EventStatus,
  NewEvent,
  WithPhoto,
} from '../types/event.ts';
import { CategoriesService } from './categories.service.ts';
import { sessionScheduleChanged } from './session-start.ts';
import { requireVerifiedOrganization } from './verified-organization.ts';

@Injectable()
export class EventsService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly venuesRepository: VenuesRepository,
    private readonly categoriesService: CategoriesService,
    private readonly imagesService: ImagesService,
    private readonly transactions: TransactionRunner,
    private readonly jobs: JobQueue,
  ) {}

  async stats(): Promise<{ events: number }> {
    return { events: await this.eventsRepository.countPublishedEndingAfter(new Date()) };
  }

  async list(query: EventQuery, page: PageRequest): Promise<Page<WithPhoto<Event>>> {
    const { from: today, to: windowEnd } = catalogWindow();
    const from = query.from && query.from > today ? query.from : today;
    const to = query.to && query.to < windowEnd ? query.to : windowEnd;
    return this.pageWithPhotos(await this.eventsRepository.findPublished({ ...query, from, to }, page));
  }

  /** The caller's events that have not ended, published and cancelled, soonest first; empty for a non-organization. */
  async listOwn(accountId: string, page: PageRequest): Promise<Page<WithPhoto<Event>>> {
    return this.pageWithPhotos(await this.eventsRepository.findByOrganization(accountId, new Date(), page));
  }

  /** For the admin panel: every event, past and cancelled ones too. */
  async search(filter: EventSearch, page: PageRequest): Promise<Page<WithPhoto<EventOverview>>> {
    return this.pageWithPhotos(await this.eventsRepository.search(filter, new Date(), page));
  }

  async getOverview(id: string): Promise<WithPhoto<EventOverview>> {
    const event = await this.eventsRepository.findOverview(id);
    if (!event) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    return this.withPhoto(event);
  }

  async find(id: string): Promise<Event | undefined> {
    return this.eventsRepository.findById(id);
  }

  async getById(id: string): Promise<WithPhoto<Event>> {
    return this.withPhoto(await this.getStored(id));
  }

  async create(accountId: string, input: NewEvent): Promise<WithPhoto<Event>> {
    await requireVerifiedOrganization(this.organizationsRepository, accountId);
    await this.checkReferences(accountId, input);
    checkTimes(input.startsAt, input.endsAt);
    const event = await this.eventsRepository.create({
      ...input,
      source: 'organization',
      status: 'published',
      organizationId: accountId,
    });
    return { ...event, photo: null };
  }

  /**
   * Replaces every editable field. Anyone but the posting organization is told the event does not exist. When the
   * new times change a session that is still ahead, matching is told in the same transaction (`event.changed`).
   */
  async update(accountId: string, id: string, input: NewEvent): Promise<WithPhoto<Event>> {
    const event = await this.getEditable(accountId, id);
    await this.checkReferences(accountId, input);
    checkTimes(input.startsAt, input.endsAt);
    if (!sessionScheduleChanged(event, input, new Date())) {
      return this.withPhoto(await this.eventsRepository.update(id, input));
    }
    return this.withPhoto(await this.changeAndTell(id, input, 'rescheduled'));
  }

  /** Cancels the event and tells matching in the same transaction; cancelling again changes nothing. */
  async cancel(accountId: string, id: string): Promise<WithPhoto<Event>> {
    const event = await this.getOwned(accountId, id);
    if (event.status === 'cancelled') {
      return this.withPhoto(event);
    }
    return this.withPhoto(await this.changeAndTell(id, { status: 'cancelled' }, 'cancelled'));
  }

  /** Sets or replaces the cover of the organization's own event; a cancelled event keeps the one it has. */
  async setPhoto(accountId: string, id: string, upload: ImageUpload): Promise<WithPhoto<Event>> {
    const event = await this.getEditable(accountId, id);
    const prepared = await this.imagesService.prepare('eventPhoto', upload);
    const updated = await this.transactions.run(async (tx) => {
      const image = await this.imagesService.save(accountId, prepared, tx);
      const changed = await this.eventsRepository.setPhoto(id, image.id, tx);
      await this.imagesService.remove([event.photoId], tx);
      return changed;
    });
    return this.withPhoto(updated);
  }

  /** Without a cover, nothing changes. */
  async removePhoto(accountId: string, id: string): Promise<WithPhoto<Event>> {
    const event = await this.getEditable(accountId, id);
    const { photoId } = event;
    if (photoId === null) {
      return { ...event, photo: null };
    }
    const updated = await this.transactions.run(async (tx) => {
      const changed = await this.eventsRepository.setPhoto(id, null, tx);
      await this.imagesService.remove([photoId], tx);
      return changed;
    });
    return { ...updated, photo: null };
  }

  private async getStored(id: string): Promise<Event> {
    const event = await this.eventsRepository.findById(id);
    if (!event) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    return event;
  }

  /** The change and its `event.changed` job commit together, so applicants never miss one (job-queue.md, rule 1). */
  private changeAndTell(
    id: string,
    changes: EventChanges & { status?: EventStatus },
    change: EventChange,
  ): Promise<Event> {
    return this.transactions.run(async (tx) => {
      const event = await this.eventsRepository.update(id, changes, tx);
      await this.jobs.enqueue<EventChangedPayload>(EVENT_CHANGED_JOB, { eventId: id, change }, undefined, tx);
      return event;
    });
  }

  private async getOwned(accountId: string, id: string): Promise<Event> {
    const event = await this.getStored(id);
    if (event.organizationId !== accountId) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    return event;
  }

  /** The organization's own event, while it is verified and the event is not cancelled. */
  private async getEditable(accountId: string, id: string): Promise<Event> {
    const event = await this.getOwned(accountId, id);
    await requireVerifiedOrganization(this.organizationsRepository, accountId);
    if (event.status === 'cancelled') {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event can no longer be edited');
    }
    return event;
  }

  private async withPhoto<T extends Event>(event: T): Promise<WithPhoto<T>> {
    const [withPhoto] = await this.withPhotos([event]);
    return withPhoto as WithPhoto<T>;
  }

  private async withPhotos<T extends Event>(events: T[]): Promise<WithPhoto<T>[]> {
    const photos = await this.imagesService.getRefs(events.map((event) => event.photoId));
    return events.map((event) => {
      const photo = event.photoId === null ? undefined : photos.get(event.photoId);
      return { ...event, photo: photo?.crop ? { ...photo, crop: photo.crop } : null };
    });
  }

  private async pageWithPhotos<T extends Event>(page: Page<T>): Promise<Page<WithPhoto<T>>> {
    return { ...page, items: await this.withPhotos(page.items) };
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
