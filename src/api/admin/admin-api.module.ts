// Written with the help of Claude
import { Module } from '@nestjs/common';
import { AdminModule } from '../../core/admin/admin.module.ts';
import { AdminAccountsController } from './controllers/admin-accounts.controller.ts';
import { AdminBackupsController } from './controllers/admin-backups.controller.ts';
import { AdminStatsController } from './controllers/admin-stats.controller.ts';

@Module({
  imports: [AdminModule],
  controllers: [AdminStatsController, AdminAccountsController, AdminBackupsController],
})
export class AdminApiModule {}
