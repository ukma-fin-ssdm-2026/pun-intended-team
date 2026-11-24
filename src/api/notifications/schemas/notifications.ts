// Written with the help of Claude
import { z } from 'zod';
import { devicePlatforms } from '../../../core/notifications/types/device-token.ts';
import { notificationTypes } from '../../../core/notifications/types/notification.ts';
import { DateTime, Id, PageQuery, pageOf } from '../../common/schemas/common.ts';

export const NotificationType = z.enum(notificationTypes).meta({
  id: 'NotificationType',
  description: 'What the notification is about; the app picks the text by it. `report_received`: a report was filed',
});

const NotificationFields = z.object({
  id: Id,
  type: NotificationType,
  payload: z
    .record(z.string(), z.unknown())
    .describe(
      'Details by type, never contact details; `report_received` has none, so `{}`. `event_changed`: `eventId`, ' +
        '`applicationId`, `change` (`cancelled` or `rescheduled`) and `sessions`, the days of the application that ' +
        'changed as `{ from, to }`, where `to` is the new start or null when the day is no longer on, ' +
        '`applicationCancelled`, true when the change cancelled the application, and `match` `{ id, cancelled }` ' +
        'when the application has a mutual match',
    ),
  readAt: DateTime.nullable().describe('When the caller first marked it read; null while unread'),
  createdAt: DateTime,
});

export const notificationExample: Notification = {
  id: '2b4d6f8a-0c1e-4a3b-9d5f-7a9c1e3b5d70',
  type: 'report_received',
  payload: {},
  readAt: null,
  createdAt: '2026-11-15T10:00:00.000Z',
};

export const Notification = NotificationFields.meta({
  id: 'Notification',
  description: 'One row of the caller’s inbox',
  example: notificationExample,
});

export const NotificationsPage = pageOf(Notification, 'NotificationsPage', notificationExample);

export const NotificationIdParams = z.object({
  id: Id.describe('Notification id'),
});

export const ListNotificationsQuery = PageQuery;

const RegisterPushTokenFields = z.strictObject({
  pushToken: z
    .string()
    .max(200)
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'An Expo push token: ExponentPushToken[…]')
    .describe('The Expo push token of the app on this device, from getExpoPushTokenAsync; never returned'),
  platform: z.enum(devicePlatforms).describe('ios or android'),
});

export const registerPushTokenExample: RegisterPushTokenBody = {
  pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  platform: 'android',
};

export const RegisterPushTokenBody = RegisterPushTokenFields.meta({
  id: 'RegisterPushTokenBody',
  description: 'The push token of the device this session runs on',
  example: registerPushTokenExample,
});

export type Notification = z.infer<typeof NotificationFields>;
export type RegisterPushTokenBody = z.input<typeof RegisterPushTokenFields>;
export type NotificationsPage = z.infer<typeof NotificationsPage>;
