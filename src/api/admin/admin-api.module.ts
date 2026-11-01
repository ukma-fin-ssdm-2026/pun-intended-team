// Written with the help of Claude
import { Module } from '@nestjs/common';
import { AdminModule } from '../../core/admin/admin.module.ts';
import { AdminStatsController } from './controllers/admin-stats.controller.ts';

@Module({
  imports: [AdminModule],
  controllers: [AdminStatsController],
})
export class AdminApiModule {}
