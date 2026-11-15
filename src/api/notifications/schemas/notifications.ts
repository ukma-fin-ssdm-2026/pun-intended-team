// Written with the help of Claude
import { z } from 'zod';
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
    .describe('Details by type, never contact details; `report_received` has none, so `{}`'),
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

export type Notification = z.infer<typeof NotificationFields>;
export type NotificationsPage = z.infer<typeof NotificationsPage>;
