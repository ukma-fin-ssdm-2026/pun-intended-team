// Written with the help of Claude
import { Logger } from '@nestjs/common';
import { MessagingProvider } from '../../core/notifications/adapters/messaging-provider.ts';
import type { CodeDelivery } from '../../core/notifications/types/code-delivery.ts';
import type { CodeSender } from './code-sender.ts';
import { maskPhone } from './mask-phone.ts';

/** Tries each channel in order, Telegram first, and uses the first that takes the code. */
export class FallbackMessagingProvider implements MessagingProvider {
  readonly sendsCodes = true;
  private readonly logger = new Logger('Messaging');

  constructor(private readonly senders: CodeSender[]) {}

  async sendCode(phone: string, code: string): Promise<CodeDelivery> {
    for (const sender of this.senders) {
      try {
        return { channel: sender.channel, providerRequestId: await sender.send(phone, code) };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`${sender.channel} did not take the code for ${maskPhone(phone)}: ${reason}`);
      }
    }
    throw new Error(`No channel took the code for ${maskPhone(phone)}`);
  }
}
