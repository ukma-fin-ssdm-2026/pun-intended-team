// Written with the help of Claude
import { Router } from 'express';
import { defineRoute } from '../lib/define-route.js';
import { Routes } from '../routes.js';
import { HealthResponse } from '../schemas/system.js';

export const systemController = Router();

defineRoute(systemController, {
  method: 'get',
  path: Routes.system.health,
  operationId: 'getHealth',
  summary: 'Check that the API is running',
  tags: ['System'],
  responses: {
    200: { description: 'The API is up', schema: HealthResponse },
  },
  handler: (_input, res) => {
    res.status(200).json({ status: 'ok' } satisfies HealthResponse);
  },
});
