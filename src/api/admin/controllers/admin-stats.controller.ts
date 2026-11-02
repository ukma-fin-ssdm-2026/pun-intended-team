// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { StatsService } from '../../../core/admin/services/stats.service.ts';
import { Endpoint } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { PlatformStats } from '../schemas/stats.ts';

@Controller()
export class AdminStatsController {
  constructor(private readonly statsService: StatsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.stats,
    operationId: 'adminGetStats',
    summary: 'Get platform statistics',
    description: 'Count active users, upcoming events, matches and open report cases.',
    tags: ['Admin'],
    access: 'admin',
    responses: {
      200: { description: 'The current counts', schema: PlatformStats },
    },
  })
  async getStats(): Promise<PlatformStats> {
    return this.statsService.get();
  }
}
