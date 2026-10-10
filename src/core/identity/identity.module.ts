// Written with the help of Claude
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.ts';
import { AccountsService } from './services/accounts.service.ts';
import { AuthService } from './services/auth.service.ts';

@Module({
  imports: [NotificationsModule],
  providers: [AuthService, AccountsService],
  exports: [AuthService, AccountsService],
})
export class IdentityModule {}
