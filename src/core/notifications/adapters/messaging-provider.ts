// Written with the help of Claude
/** Delivers verification codes to a phone number (HLD I5). */
export abstract class MessagingProvider {
  abstract sendCode(phone: string, code: string): Promise<void>;
}
