// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { EventsService } from '../../../core/catalog/services/events.service.js';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.js';
import { Routes } from '../../common/routes.js';
import { ErrorResponse } from '../../common/schemas/errors.js';
import { Event, EventIdParams } from '../schemas/events.js';

const GetEventRequest = { params: EventIdParams } satisfies RequestSchemas;

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.events.byId,
    operationId: 'getEvent',
    summary: 'Get an event',
    tags: ['Events'],
    request: GetEventRequest,
    responses: {
      200: { description: 'The event', schema: Event },
      404: { description: 'No event with this id, or the caller may not access it', schema: ErrorResponse },
    },
  })
  async getEvent(@Input() { params }: RouteInput<typeof GetEventRequest>): Promise<Event> {
    return this.eventsService.getById(params.id);
  }
}
