// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { EventsService } from '../../../core/catalog/services/events.service.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { AdminEvent, AdminEventsPage, EventIdParams, ListAdminEventsQuery } from '../schemas/events.ts';

const ListEventsRequest = { query: ListAdminEventsQuery } satisfies RequestSchemas;
const GetEventRequest = { params: EventIdParams } satisfies RequestSchemas;

@Controller()
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.events,
    operationId: 'adminListEvents',
    summary: 'List all events',
    description:
      'List every event, imported or added by an organization, published or cancelled, upcoming or past. ' +
      'For the catalog users see, use listEvents.',
    tags: ['Events'],
    access: 'admin',
    request: ListEventsRequest,
    responses: {
      200: { description: 'A page of events', schema: AdminEventsPage },
    },
  })
  async listEvents(@Input() { query }: RouteInput<typeof ListEventsRequest>): Promise<AdminEventsPage> {
    const { limit, offset, ...filter } = query;
    return this.eventsService.search(filter, { limit, offset });
  }

  @Endpoint({
    method: 'get',
    path: Routes.admin.eventById,
    operationId: 'adminGetEvent',
    summary: 'Get any event',
    description: 'Get one event in any status, past ones too, with who added it.',
    tags: ['Events'],
    access: 'admin',
    request: GetEventRequest,
    responses: {
      200: { description: 'The event', schema: AdminEvent },
      404: { description: 'No event with this id, or the caller is not an administrator', schema: ErrorResponse },
    },
  })
  async getEvent(@Input() { params }: RouteInput<typeof GetEventRequest>): Promise<AdminEvent> {
    return this.eventsService.getOverview(params.id);
  }
}
