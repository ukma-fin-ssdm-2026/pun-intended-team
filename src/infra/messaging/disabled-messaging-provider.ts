// Written with the help of Claude
import { MessagingProvider } from '../../core/notifications/adapters/messaging-provider.ts';
import type { CodeDelivery } from '../../core/notifications/types/code-delivery.ts';

/** Phone codes switched off while paid delivery is paused; the auth service checks `sendsCodes` first. */
export class DisabledMessagingProvider implements MessagingProvider {
  readonly sendsCodes = false;

  sendCode(): Promise<CodeDelivery> {
    return Promise.reject(new Error('Phone codes are switched off (MESSAGING_PROVIDER=disabled)'));
  }
}
