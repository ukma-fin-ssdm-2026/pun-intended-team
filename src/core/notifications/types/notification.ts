// Written with the help of Claude
export type NotificationType =
  | 'match_proposed'
  | 'match_mutual'
  | 'respond_soon'
  | 'not_a_match'
  | 'continue_matching'
  | 'removed_from_matching'
  | 'no_match_found'
  | 'event_reminder'
  | 'event_changed'
  | 'report_received';

/** A row for a user's inbox (notifications.md). */
export interface NewNotification {
  accountId: string;
  type: NotificationType;
  /** What the client needs to show the notification; plain JSON. */
  payload: object;
  /** Names the fact the user is told about: a second notification with the same key is not written. */
  dedupeKey: string;
}
