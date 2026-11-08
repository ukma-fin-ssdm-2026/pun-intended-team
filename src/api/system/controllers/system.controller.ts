// Written with the help of Claude
import { Controller, HttpStatus, Res } from '@nestjs/common';
import { SECOND_MS } from '../../../core/common/durations.ts';
import { HEALTH_CHECK_TIMEOUT_MS, HealthService } from '../../../core/system/services/health.service.ts';
import { Endpoint } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { HealthResponse } from '../schemas/system.ts';

@Controller()
export class SystemController {
  constructor(private readonly health: HealthService) {}

  @Endpoint({
    method: 'get',
    path: Routes.system.health,
    operationId: 'getHealth',
    summary: 'Check that the API and its database are up',
    description:
      `Checks that the API is running and that its database answers within ${HEALTH_CHECK_TIMEOUT_MS / SECOND_MS} s. ` +
      '`200` while it is healthy; `503` with the dependency that is down in `checks`.',
    tags: ['System'],
    access: 'public',
    responses: {
      200: { description: 'The API and its database are up', schema: HealthResponse },
      503: { description: 'A dependency the API needs is down', schema: HealthResponse },
    },
  })
  async getHealth(@Res({ passthrough: true }) res: { status(code: number): unknown }): Promise<HealthResponse> {
    const health = await this.health.check();
    if (health.status === 'unhealthy') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
