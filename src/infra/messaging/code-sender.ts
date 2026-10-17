// Written with the help of Claude
import type { DeliveryChannel } from '../../core/notifications/types/code-delivery.ts';

/** One delivery channel for verification codes. */
export interface CodeSender {
  readonly channel: DeliveryChannel;

  /** Resolves with the provider's id of the request; throws when the provider did not take the code. */
  send(phone: string, code: string): Promise<string>;
}
