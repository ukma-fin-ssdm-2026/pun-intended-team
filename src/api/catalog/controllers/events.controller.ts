// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { EventsService } from '../../../core/catalog/services/events.service.js';
import type { AccountCaller } from '../../../core/identity/types/caller.js';
import { CurrentAccount } from '../../common/auth.js';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.js';
import { Routes } from '../../common/routes.js';
import { ErrorResponse } from '../../common/schemas/errors.js';
import { CreateEventBody, Event, EventIdParams, EventsPage, ListEventsQuery, UpdateEventBody } from '../schemas/events.js';

const ListEventsRequest = { query: ListEventsQuery } satisfies RequestSchemas;
const GetEventRequest = { params: EventIdParams } satisfies RequestSchemas;
const CreateEventRequest = { body: CreateEventBody } satisfies RequestSchemas;
const UpdateEventRequest = { params: EventIdParams, body: UpdateEventBody } satisfies RequestSchemas;
const CancelEventRequest = { params: EventIdParams } satisfies RequestSchemas;

const NOT_OWN_EVENT = {
  description: 'No event with this id, or it is not one of the organization’s own',
  schema: ErrorResponse,
};

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.events.list,
    operationId: 'listEvents',
    summary: 'Browse the event catalog',
    description: 'Published events in the catalog window, soonest first.',
    tags: ['Events'],
    access: 'guest',
    request: ListEventsRequest,
    responses: {
      200: { description: 'A page of events', schema: EventsPage },
    },
  })
  async listEvents(@Input() { query }: RouteInput<typeof ListEventsRequest>): Promise<EventsPage> {
    const { limit, offset, ...filter } = query;
    return this.eventsService.list(filter, { limit, offset });
  }

  @Endpoint({
    method: 'get',
    path: Routes.events.byId,
    operationId: 'getEvent',
    summary: 'Get an event',
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
    method: 'patch',
    path: Routes.events.byId,
    operationId: 'updateEvent',
    summary: 'Edit an event',
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
    description: 'The event stays readable with status `cancelled`. Cancelling it again changes nothing.',
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
}
