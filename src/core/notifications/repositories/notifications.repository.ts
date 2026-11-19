// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import type { NewNotification, Notification, PushStatus } from '../types/notification.ts';

/** The inbox: the notifications table, which only the notifications module reads (notifications.md, rule 4). */
export abstract class NotificationsRepository {
  /**
   * Stores the notification. When one with its dedupe key already exists, stores nothing, does not fail, and gives
   * undefined.
   */
  abstract create(notification: NewNotification, tx?: Transaction): Promise<Notification | undefined>;

  abstract findById(id: string, tx?: Transaction): Promise<Notification | undefined>;

  /** The account's notifications, newest first. */
  abstract findByAccount(accountId: string, page: PageRequest, tx?: Transaction): Promise<Page<Notification>>;

  /**
   * Marks the account's notification read, keeping the first time it was read; undefined when the account has no
   * notification with this id.
   */
  abstract markRead(accountId: string, id: string, tx?: Transaction): Promise<Notification | undefined>;

  /** Sets the push status to `to` if it is still `from`; false when it changed meanwhile or the row is gone. */
  abstract updatePushStatus(id: string, from: PushStatus, to: PushStatus, tx?: Transaction): Promise<boolean>;
}
