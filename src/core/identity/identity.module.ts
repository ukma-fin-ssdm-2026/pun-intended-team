// Written with the help of Claude
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.ts';
import { AccountsService } from './services/accounts.service.ts';
import { AuthService } from './services/auth.service.ts';
import { SessionsService } from './services/sessions.service.ts';

@Module({
  imports: [NotificationsModule],
  providers: [AuthService, AccountsService, SessionsService],
  exports: [AuthService, AccountsService, SessionsService],
})
export class IdentityModule {}
