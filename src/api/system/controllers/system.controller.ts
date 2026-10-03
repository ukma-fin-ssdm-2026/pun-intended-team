// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { Endpoint } from '../../common/endpoint.js';
import { Routes } from '../../common/routes.js';
import { HealthResponse } from '../schemas/system.js';

@Controller()
export class SystemController {
  @Endpoint({
    method: 'get',
    path: Routes.system.health,
    operationId: 'getHealth',
    summary: 'Check that the API is running',
    tags: ['System'],
    access: 'public',
    responses: {
      200: { description: 'The API is up', schema: HealthResponse },
    },
  })
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
