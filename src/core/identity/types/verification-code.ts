// Written with the help of Claude
import type { DeliveryChannel } from '../../notifications/types/code-delivery.ts';

export type CodePurpose = 'registration' | 'reset';

export interface VerificationCode {
  id: string;
  phone: string;
  purpose: CodePurpose;
  codeHash: string;
  channel: DeliveryChannel;
  providerRequestId: string | null;
  sentAt: Date;
  expiresAt: Date;
  failedAttempts: number;
  usedAt: Date | null;
}

/** A new row as the repository stores it. */
export type VerificationCodeRecord = Omit<VerificationCode, 'id' | 'failedAttempts' | 'usedAt'>;
