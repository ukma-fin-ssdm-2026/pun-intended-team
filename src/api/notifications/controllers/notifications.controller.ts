// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { NotificationsService } from '../../../core/notifications/services/notifications.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import {
  ListNotificationsQuery,
  Notification,
  NotificationIdParams,
  NotificationsPage,
} from '../schemas/notifications.ts';

const ListNotificationsRequest = { query: ListNotificationsQuery } satisfies RequestSchemas;
const ReadNotificationRequest = { params: NotificationIdParams } satisfies RequestSchemas;

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.notifications.mine,
    operationId: 'listMyNotifications',
    summary: 'List your notifications',
    description: 'The caller’s inbox, newest first, read and unread alike.',
    tags: ['Notifications'],
    access: 'user',
    request: ListNotificationsRequest,
    responses: {
      200: { description: 'A page of notifications', schema: NotificationsPage },
    },
  })
  async listMyNotifications(
    @Input() { query }: RouteInput<typeof ListNotificationsRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<NotificationsPage> {
    return this.notificationsService.listMine(account.accountId, query);
  }

  @Endpoint({
    method: 'post',
    path: Routes.notifications.read,
    operationId: 'readNotification',
    summary: 'Mark a notification read',
    description: 'Mark one of the caller’s notifications read. Marking it again changes nothing and keeps `readAt`.',
    tags: ['Notifications'],
    access: 'user',
    request: ReadNotificationRequest,
    responses: {
      200: { description: 'The notification, read', schema: Notification },
      404: { description: 'No notification with this id in the caller’s inbox', schema: ErrorResponse },
    },
  })
  async readNotification(
    @Input() { params }: RouteInput<typeof ReadNotificationRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Notification> {
    return this.notificationsService.markRead(account.accountId, params.id);
  }
}
