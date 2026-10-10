// Written with the help of Claude
import { Injectable, Logger } from '@nestjs/common';
import { MessagingProvider } from '../../core/notifications/adapters/messaging-provider.ts';

/** Development stand-in for the Telegram Gateway: logs the code instead of sending it. */
@Injectable()
export class ConsoleMessagingProvider implements MessagingProvider {
  private readonly logger = new Logger('Messaging');

  sendCode(phone: string, code: string): Promise<void> {
    this.logger.log(`Verification code for ${maskPhone(phone)}: ${code}`);
    return Promise.resolve();
  }
}

/** '+380501234501' -> '+380•••••4501' */
function maskPhone(phone: string): string {
  return phone.slice(0, 4) + '•'.repeat(Math.max(phone.length - 8, 0)) + phone.slice(-4);
}
