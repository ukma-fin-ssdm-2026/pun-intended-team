// Written with the help of Claude
export type CodePurpose = 'registration';

export interface VerificationCode {
  id: string;
  phone: string;
  purpose: CodePurpose;
  codeHash: string;
  sentAt: Date;
  expiresAt: Date;
  failedAttempts: number;
  usedAt: Date | null;
}

/** A new row as the repository stores it. */
export type VerificationCodeRecord = Omit<VerificationCode, 'id' | 'failedAttempts' | 'usedAt'>;
