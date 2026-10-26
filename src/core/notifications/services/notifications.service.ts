// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { MessagingProvider } from '../adapters/messaging-provider.ts';
import type { CodeDelivery } from '../types/code-delivery.ts';

@Injectable()
export class NotificationsService {
  constructor(private readonly messagingProvider: MessagingProvider) {}

  /** Sends a verification code right away; the only direct send (HLD I2, SEC-008). */
  async sendCode(phone: string, code: string): Promise<CodeDelivery> {
    return this.messagingProvider.sendCode(phone, code);
  }
}
