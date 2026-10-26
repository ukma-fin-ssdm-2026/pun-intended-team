// Written with the help of Claude
import type { DeliveryChannel } from '../../notifications/types/code-delivery.ts';

export type CodePurpose = 'registration' | 'reset';

export interface VerificationCode {
  id: string;
  phone: string;
  purpose: CodePurpose;
  codeHash: string;
  /** Null until the provider takes the code. */
  channel: DeliveryChannel | null;
  providerRequestId: string | null;
  sentAt: Date;
  expiresAt: Date;
  /** Every check of the code, the right one included. */
  attempts: number;
  usedAt: Date | null;
}

/** When a phone may get another code: none sent after `noneSentAfter`, and fewer than `atMost` since `since`. */
export interface CodeSendLimit {
  noneSentAfter: Date;
  since: Date;
  atMost: number;
}

/** A new row as the repository stores it, before the code is handed to the provider. */
export type VerificationCodeRecord = Omit<
  VerificationCode,
  'id' | 'channel' | 'providerRequestId' | 'attempts' | 'usedAt'
>;
