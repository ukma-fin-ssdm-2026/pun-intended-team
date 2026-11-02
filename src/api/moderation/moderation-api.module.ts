// Written with the help of Claude
import { Module } from '@nestjs/common';
import { ModerationModule } from '../../core/moderation/moderation.module.ts';
import { AdminReportCasesController } from './controllers/admin-report-cases.controller.ts';
import { ReportsController } from './controllers/reports.controller.ts';

@Module({
  imports: [ModerationModule],
  controllers: [ReportsController, AdminReportCasesController],
})
export class ModerationApiModule {}
