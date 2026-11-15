// Written with the help of Claude
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../core/notifications/notifications.module.ts';
import { NotificationsController } from './controllers/notifications.controller.ts';

@Module({
  imports: [NotificationsModule],
  controllers: [NotificationsController],
})
export class NotificationsApiModule {}
