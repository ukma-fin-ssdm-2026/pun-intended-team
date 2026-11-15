// Written with the help of Claude
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import type { Transaction } from '../../common/transaction.ts';
import { JobQueue } from '../../jobs/adapters/job-queue.ts';
import { MessagingProvider } from '../adapters/messaging-provider.ts';
import { PushProvider } from '../adapters/push-provider.ts';
import { DeviceTokensRepository } from '../repositories/device-tokens.repository.ts';
import { NotificationsRepository } from '../repositories/notifications.repository.ts';
import type { CodeDelivery } from '../types/code-delivery.ts';
import type { DeviceRegistration } from '../types/device-token.ts';
import type { Notification, NotificationPayload, NotificationType } from '../types/notification.ts';
import { PUSH_BATCH_LIMIT, type PushTicket } from '../types/push.ts';
import { pushContent } from './push-content.ts';

const DELIVER_JOB = 'notifications.deliver';
// Expo's code for a token whose app was removed or which changed; it will not work again.
const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly messagingProvider: MessagingProvider,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly deviceTokensRepository: DeviceTokensRepository,
    private readonly pushProvider: PushProvider,
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
   * Pushes a pending notification to every device of the account (HLD I5): `sent` when one device took it, `failed`
   * when all refused it, `skipped` without a device. A refused message is not tried again; a token Expo no longer
   * knows is removed. When a request fails as a whole, the job fails and is retried with the row still pending, so a
   * device may get the push twice (notifications.md). A repeated job finds the row no longer pending and does nothing.
   */
  async deliver(notificationId: string): Promise<void> {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (notification?.pushStatus !== 'pending') {
      return;
    }
    const devices = await this.deviceTokensRepository.findByAccount(notification.accountId);
    if (devices.length === 0) {
      await this.notificationsRepository.updatePushStatus(notificationId, 'pending', 'skipped');
      return;
    }
    const content = pushContent(notification);
    const tickets: PushTicket[] = [];
    for (let start = 0; start < devices.length; start += PUSH_BATCH_LIMIT) {
      const batch = devices.slice(start, start + PUSH_BATCH_LIMIT);
      tickets.push(...(await this.pushProvider.send(batch.map(({ pushToken }) => ({ to: pushToken, ...content })))));
    }
    const unregistered = devices
      .filter((_, index) => {
        const ticket = tickets[index];
        return ticket?.status === 'error' && ticket.error === DEVICE_NOT_REGISTERED;
      })
      .map(({ pushToken }) => pushToken);
    if (unregistered.length > 0) {
      await this.deviceTokensRepository.deleteByPushTokens(unregistered);
    }
    const delivered = tickets.some(({ status }) => status === 'ok');
    await this.notificationsRepository.updatePushStatus(notificationId, 'pending', delivered ? 'sent' : 'failed');
  }
}
