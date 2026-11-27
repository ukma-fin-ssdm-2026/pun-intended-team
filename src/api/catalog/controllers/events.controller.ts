// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { EventsService } from '../../../core/catalog/services/events.service.ts';
import { ImportFreshnessService } from '../../../core/catalog/services/import-freshness.service.ts';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { CropQuery, ImageFileBody, UPLOAD_NOTE, toCrop } from '../../images/schemas/images.ts';
import {
  CreateEventBody,
  Event,
  EventIdParams,
  EventsPage,
  ListEventsQuery,
  ListMyEventsQuery,
  MyEventsPage,
} from '../schemas/events.ts';

const ListEventsRequest = { query: ListEventsQuery } satisfies RequestSchemas;
const ListMyEventsRequest = { query: ListMyEventsQuery } satisfies RequestSchemas;
const GetEventRequest = { params: EventIdParams } satisfies RequestSchemas;
const CreateEventRequest = { body: CreateEventBody } satisfies RequestSchemas;
// PUT replaces the editable fields, so it takes the same body as POST.
const UpdateEventRequest = { params: EventIdParams, body: CreateEventBody } satisfies RequestSchemas;
const CancelEventRequest = { params: EventIdParams } satisfies RequestSchemas;
const UploadEventPhotoRequest = {
  params: EventIdParams,
  query: CropQuery,
  file: ImageFileBody,
} satisfies RequestSchemas;
const DeleteEventPhotoRequest = { params: EventIdParams } satisfies RequestSchemas;

const PHOTO_REFUSED = {
  description:
    '`EVENT_CANCELLED`: a cancelled event keeps its cover. `ORGANIZATION_NOT_VERIFIED`: as when publishing. ' +
    '`INVALID_IMAGE`: the body is not a JPEG, PNG or WebP picture.',
  schema: ErrorResponse,
};

const NOT_OWN_EVENT = {
  description: 'No event with this id, or it is not one of the organization’s own',
  schema: ErrorResponse,
};

@Controller()
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly importFreshnessService: ImportFreshnessService,
  ) {}

  @Endpoint({
    method: 'get',
    path: Routes.events.list,
    operationId: 'listEvents',
    summary: 'Browse the event catalog',
    description:
      'Browse the event catalog: published events in the catalog window, soonest first. Filters combine: an event ' +
      'shows when it is in any of `categoryIds`, at `venueId`, within `radiusKm` of `lat`, `lng` and on the days ' +
      'from `from` to `to`. ' +
      '`lastUpdatedAt` is not null while the imported events are those of an earlier import run, or of a run more ' +
      'than 30 hours ago (FR-014).',
    tags: ['Events'],
    access: 'guest',
    request: ListEventsRequest,
    responses: {
      200: { description: 'A page of events', schema: EventsPage },
    },
  })
  async listEvents(@Input() { query }: RouteInput<typeof ListEventsRequest>): Promise<EventsPage> {
    const { limit, offset, lat, lng, radiusKm, ...filter } = query;
    // The schema accepts the three only together.
    const near = lat !== undefined && lng !== undefined && radiusKm !== undefined ? { lat, lng, radiusKm } : undefined;
    const [page, lastUpdatedAt] = await Promise.all([
      this.eventsService.list({ ...filter, near }, { limit, offset }),
      this.importFreshnessService.lastUpdatedAt(),
    ]);
    return { ...page, lastUpdatedAt };
  }

  @Endpoint({
    method: 'get',
    path: Routes.events.mine,
    operationId: 'listMyEvents',
    summary: 'List your organization’s events',
    description:
      'List the events the caller’s organization has published that have not ended, the cancelled ones too, ' +
      'soonest first. Empty for an account that is not an organization.',
    tags: ['Events'],
    access: 'user',
    request: ListMyEventsRequest,
    responses: {
      200: { description: 'A page of events', schema: MyEventsPage },
    },
  })
  async listMyEvents(
    @Input() { query }: RouteInput<typeof ListMyEventsRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<MyEventsPage> {
    return this.eventsService.listOwn(account.accountId, query);
  }

  @Endpoint({
    method: 'get',
    path: Routes.events.byId,
    operationId: 'getEvent',
    summary: 'Get an event',
    description: 'Get one event with its category and venue.',
    tags: ['Events'],
    access: 'guest',
    request: GetEventRequest,
    responses: {
      200: { description: 'The event', schema: Event },
      404: { description: 'No event with this id, or the caller may not access it', schema: ErrorResponse },
    },
  })
  async getEvent(@Input() { params }: RouteInput<typeof GetEventRequest>): Promise<Event> {
    return this.eventsService.getById(params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.events.list,
    operationId: 'createEvent',
    summary: 'Publish an event',
    tags: ['Events'],
    access: 'user',
    request: CreateEventRequest,
    responses: {
      201: { description: 'The published event', schema: Event },
      422: {
        description:
          '`ORGANIZATION_NOT_VERIFIED`: the caller is not a verified organization. ' +
          '`REFERENCE_NOT_FOUND`: no such active category, or the venue is not one of the organization’s own. ' +
          '`EVENT_ENDS_BEFORE_START`.',
        schema: ErrorResponse,
      },
    },
    location: Routes.events.byId,
  })
  async createEvent(
    @Input() { body }: RouteInput<typeof CreateEventRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Event> {
    return this.eventsService.create(account.accountId, body);
  }

  @Endpoint({
    method: 'put',
    path: Routes.events.byId,
    operationId: 'updateEvent',
    summary: 'Edit an event',
    description:
      'Replace the editable fields of one of the organization’s own events; the body is the same as when publishing. ' +
      'A cancelled event cannot be edited.',
    tags: ['Events'],
    access: 'user',
    request: UpdateEventRequest,
    responses: {
      200: { description: 'The updated event', schema: Event },
      404: NOT_OWN_EVENT,
      422: {
        description:
          '`EVENT_CANCELLED`: a cancelled event cannot be edited. ' +
          '`ORGANIZATION_NOT_VERIFIED`, `REFERENCE_NOT_FOUND`, `EVENT_ENDS_BEFORE_START`: as when publishing.',
        schema: ErrorResponse,
      },
    },
  })
  async updateEvent(
    @Input() { params, body }: RouteInput<typeof UpdateEventRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Event> {
    return this.eventsService.update(account.accountId, params.id, body);
  }

  @Endpoint({
    method: 'post',
    path: Routes.events.cancel,
    operationId: 'cancelEvent',
    summary: 'Cancel an event',
    description:
      'Cancel one of the organization’s own events. ' +
      'It stays readable with status `cancelled`; cancelling it again changes nothing.',
    tags: ['Events'],
    access: 'user',
    request: CancelEventRequest,
    responses: {
      200: { description: 'The cancelled event', schema: Event },
      404: NOT_OWN_EVENT,
    },
  })
  async cancelEvent(
    @Input() { params }: RouteInput<typeof CancelEventRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Event> {
    return this.eventsService.cancel(account.accountId, params.id);
  }

  @Endpoint({
    method: 'put',
    path: Routes.events.photo,
    operationId: 'uploadEventPhoto',
    summary: 'Add a cover to your event',
    description:
      'Set or replace the cover of one of the organization’s own events. The crop is the catalog card’s 2:1 shape, and ' +
      `the whole picture is kept (up to 2560 px), so the event page shows more around it. ${UPLOAD_NOTE}`,
    tags: ['Events'],
    access: 'user',
    request: UploadEventPhotoRequest,
    responses: {
      200: { description: 'The updated event', schema: Event },
      404: NOT_OWN_EVENT,
      422: PHOTO_REFUSED,
    },
    mcp: false,
  })
  async uploadEventPhoto(
    @Input() { params, query, file }: RouteInput<typeof UploadEventPhotoRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Event> {
    return this.eventsService.setPhoto(account.accountId, params.id, { ...file, crop: toCrop(query) });
  }

  @Endpoint({
    method: 'delete',
    path: Routes.events.photo,
    operationId: 'deleteEventPhoto',
    summary: 'Remove the cover of your event',
    description: 'Remove the cover of one of the organization’s own events. Without a cover, nothing changes.',
    tags: ['Events'],
    access: 'user',
    request: DeleteEventPhotoRequest,
    responses: {
      200: { description: 'The updated event', schema: Event },
      404: NOT_OWN_EVENT,
      422: {
        description: '`EVENT_CANCELLED`, `ORGANIZATION_NOT_VERIFIED`: as when adding a cover.',
        schema: ErrorResponse,
      },
    },
  })
  async deleteEventPhoto(
    @Input() { params }: RouteInput<typeof DeleteEventPhotoRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Event> {
    return this.eventsService.removePhoto(account.accountId, params.id);
  }
}
