// Written with the help of Claude
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import type { Transaction } from '../../common/transaction.ts';
import { JobQueue } from '../../jobs/adapters/job-queue.ts';
import { MessagingProvider } from '../adapters/messaging-provider.ts';
import { DeviceTokensRepository } from '../repositories/device-tokens.repository.ts';
import { NotificationsRepository } from '../repositories/notifications.repository.ts';
import type { CodeDelivery } from '../types/code-delivery.ts';
import type { DeviceRegistration } from '../types/device-token.ts';
import type { Notification, NotificationPayload, NotificationType } from '../types/notification.ts';

const DELIVER_JOB = 'notifications.deliver';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly messagingProvider: MessagingProvider,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly deviceTokensRepository: DeviceTokensRepository,
    private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register<{ notificationId: string }>(DELIVER_JOB, ({ payload }) => this.deliver(payload.notificationId));
  }

  get sendsCodes(): boolean {
    return this.messagingProvider.sendsCodes;
  }

  /** Sends a verification code right away; the only direct send (HLD I2, SEC-008). */
  async sendCode(phone: string, code: string): Promise<CodeDelivery> {
    return this.messagingProvider.sendCode(phone, code);
  }

  /**
   * Puts a notification in the account's inbox and enqueues its delivery, both in `tx`, the transaction of the change
   * that causes it (notifications.md, rule 1). A sender that runs again passes the same `dedupeKey`: nothing more is
   * stored or enqueued, and the result is undefined.
   */
  async notify(
    accountId: string,
    type: NotificationType,
    payload: NotificationPayload,
    dedupeKey: string,
    tx: Transaction,
  ): Promise<Notification | undefined> {
    const notification = await this.notificationsRepository.create({ accountId, type, payload, dedupeKey }, tx);
    if (notification) {
      await this.jobs.enqueue(DELIVER_JOB, { notificationId: notification.id }, undefined, tx);
    }
    return notification;
  }

  /** The account's inbox, newest first. */
  async listMine(accountId: string, page: PageRequest): Promise<Page<Notification>> {
    return this.notificationsRepository.findByAccount(accountId, page);
  }

  /** Marks the account's own notification read; reading it again keeps the first time. */
  async markRead(accountId: string, id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.markRead(accountId, id);
    if (!notification) {
      throw new DomainError('NOT_FOUND', 'Notification not found');
    }
    return notification;
  }

  /**
   * Registers the device the session runs on for push. One device per session: a new token replaces the last one,
   * and a token another account or session registered moves to this one, as when someone else signs in on the phone.
   */
  async registerDevice(accountId: string, sessionId: string, device: DeviceRegistration): Promise<void> {
    await this.deviceTokensRepository.register({ accountId, sessionId, ...device });
  }

  /** Stops pushes to the device of the session: on sign-out, or when the session ends for any other reason. */
  async removeDevice(sessionId: string, tx?: Transaction): Promise<void> {
    await this.deviceTokensRepository.deleteBySession(sessionId, tx);
  }

  /** Stops pushes to the devices of every session of the account but `exceptSessionId`, as their sessions end. */
  async removeDevices(accountId: string, exceptSessionId?: string, tx?: Transaction): Promise<void> {
    await this.deviceTokensRepository.deleteByAccount(accountId, exceptSessionId, tx);
  }

  /**
   * Delivers a notification by push. Push is not built yet, so a pending one is marked skipped. The job may run
   * again (job queue, rule 2): a notification that is gone or no longer pending is left as it is.
   */
  async deliver(notificationId: string): Promise<void> {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (notification?.pushStatus !== 'pending') {
      return;
    }
    await this.notificationsRepository.updatePushStatus(notificationId, 'pending', 'skipped');
  }
}
