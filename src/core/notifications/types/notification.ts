// Written with the help of Claude
/** The notifications of the catalogue (notifications.md); the app picks the text by type. */
export const notificationTypes = [
  'match_proposed',
  'match_mutual',
  'respond_soon',
  'not_a_match',
  'continue_matching',
  'removed_from_matching',
  'no_match_found',
  'event_reminder',
  'event_changed',
  'report_received',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

/** Where the push of a notification stands; `skipped` when there was nothing to push it to. */
export type PushStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/** What the notification is about, beyond its type, as plain JSON. Never contact details (data model). */
export type NotificationPayload = Record<string, unknown>;

/** One row of a user's inbox. */
export interface Notification {
  id: string;
  accountId: string;
  type: NotificationType;
  payload: NotificationPayload;
  pushStatus: PushStatus;
  readAt: string | null;
  createdAt: string;
}

/** A notification to store; one per `dedupeKey`, so a sender that runs twice notifies once. */
export interface NewNotification {
  accountId: string;
  type: NotificationType;
  payload: NotificationPayload;
  dedupeKey: string;
}
