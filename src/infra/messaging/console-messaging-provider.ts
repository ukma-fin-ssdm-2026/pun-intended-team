// Written with the help of Claude
import { Injectable, Logger } from '@nestjs/common';
import { MessagingProvider } from '../../core/notifications/adapters/messaging-provider.ts';
import type { CodeDelivery } from '../../core/notifications/types/code-delivery.ts';
import { maskPhone } from './mask-phone.ts';

/** Development stand-in for the Telegram Gateway: logs the code instead of sending it. */
@Injectable()
export class ConsoleMessagingProvider implements MessagingProvider {
  readonly sendsCodes = true;
  private readonly logger = new Logger('Messaging');

  sendCode(phone: string, code: string): Promise<CodeDelivery> {
    this.logger.log(`Verification code for ${maskPhone(phone)}: ${code}`);
    return Promise.resolve({ channel: 'telegram', providerRequestId: null });
  }
}
