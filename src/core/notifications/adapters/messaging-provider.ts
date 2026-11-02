// Written with the help of Claude
import type { CodeDelivery } from '../types/code-delivery.ts';

/** Delivers verification codes to a phone number (HLD I5). */
export abstract class MessagingProvider {
  /** False while phone codes are switched off; nothing is then sent. */
  abstract readonly sendsCodes: boolean;

  abstract sendCode(phone: string, code: string): Promise<CodeDelivery>;
}
