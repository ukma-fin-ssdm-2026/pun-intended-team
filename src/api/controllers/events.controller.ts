// Written with the help of Claude
import { Router } from 'express';
import { defineRoute } from '../lib/define-route.js';
import { sendError } from '../lib/errors.js';
import { Routes } from '../routes.js';
import { ErrorResponse } from '../schemas/errors.js';
import { Event, EventIdParams } from '../schemas/events.js';
import { eventsService } from '../services/events.service.js';

export const eventsController = Router();

defineRoute(eventsController, {
  method: 'get',
  path: Routes.events.byId,
  operationId: 'getEvent',
  summary: 'Get an event',
  tags: ['Events'],
  request: { params: EventIdParams },
  responses: {
    200: { description: 'The event', schema: Event },
    404: { description: 'No event with this id', schema: ErrorResponse },
  },
  handler: async ({ params }, res) => {
    const event = await eventsService.getById(params.id);
    if (!event) {
      sendError(res, 404, 'NOT_FOUND', 'Event not found');
      return;
    }
    res.status(200).json(event);
  },
});
