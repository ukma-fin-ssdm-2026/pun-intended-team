// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../common/transaction.ts';
import { MessagingProvider } from '../adapters/messaging-provider.ts';
import { NotificationsRepository } from '../repositories/notifications.repository.ts';
import type { CodeDelivery } from '../types/code-delivery.ts';
import type { NewNotification } from '../types/notification.ts';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly messagingProvider: MessagingProvider,
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  get sendsCodes(): boolean {
    return this.messagingProvider.sendsCodes;
  }

  /** Sends a verification code right away; the only direct send (HLD I2, SEC-008). */
  async sendCode(phone: string, code: string): Promise<CodeDelivery> {
    return this.messagingProvider.sendCode(phone, code);
  }

  /**
   * Writes the notification to the user's inbox in the caller's transaction, so it exists exactly when the change it
   * tells about does (notifications.md, rule 1). Does nothing, and returns false, when the user was already told
   * (`dedupeKey`). Nothing is pushed yet: the row is marked so, and no delivery job is enqueued.
   */
  async notify(notification: NewNotification, tx: Transaction): Promise<boolean> {
    return this.notificationsRepository.createOnce(notification, tx);
  }
}
