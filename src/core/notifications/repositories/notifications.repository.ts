// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { NewNotification } from '../types/notification.ts';

export abstract class NotificationsRepository {
  /**
   * Writes the inbox row unless one with its `dedupeKey` exists; true when it was written. The row is marked as not
   * to be pushed, since nothing delivers pushes yet.
   */
  abstract createOnce(notification: NewNotification, tx?: Transaction): Promise<boolean>;
}
