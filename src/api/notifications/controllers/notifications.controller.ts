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
  RegisterPushTokenBody,
} from '../schemas/notifications.ts';

const ListNotificationsRequest = { query: ListNotificationsQuery } satisfies RequestSchemas;
const ReadNotificationRequest = { params: NotificationIdParams } satisfies RequestSchemas;
const RegisterPushTokenRequest = { body: RegisterPushTokenBody } satisfies RequestSchemas;

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

  // Not MCP tools (mcp: false): an agent has no device to get pushes on.
  @Endpoint({
    method: 'put',
    path: Routes.notifications.pushToken,
    operationId: 'registerPushToken',
    summary: 'Register this device for push',
    description:
      'Register the Expo push token of the device this session runs on. One token per session: a new one ' +
      'replaces the last, and a token registered before by another account or session moves to this one. The ' +
      'token is removed when the session ends (sign-out, a ban, a refresh with a stolen token).',
    tags: ['Notifications'],
    access: 'user',
    mcp: false,
    request: RegisterPushTokenRequest,
    responses: {
      204: { description: 'The device gets the caller’s pushes' },
    },
  })
  async registerPushToken(
    @Input() { body }: RouteInput<typeof RegisterPushTokenRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<void> {
    await this.notificationsService.registerDevice(account.accountId, account.sessionId, body);
  }

  @Endpoint({
    method: 'delete',
    path: Routes.notifications.pushToken,
    operationId: 'removePushToken',
    summary: 'Stop push on this device',
    description:
      'Remove the push token of this session, e.g. when the user turns push off. Removing it again, or when none ' +
      'was registered, also answers 204.',
    tags: ['Notifications'],
    access: 'user',
    mcp: false,
    responses: {
      204: { description: 'The device gets no more pushes' },
    },
  })
  async removePushToken(@CurrentAccount() account: AccountCaller): Promise<void> {
    await this.notificationsService.removeDevice(account.sessionId);
  }
}
