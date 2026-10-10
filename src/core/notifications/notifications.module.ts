// Written with the help of Claude
import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service.ts';

@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
