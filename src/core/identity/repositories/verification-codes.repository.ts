// Written with the help of Claude
import type { CodePurpose, VerificationCode, VerificationCodeRecord } from '../types/verification-code.ts';

export abstract class VerificationCodesRepository {
  /** The code sent last to this phone for this purpose; only it can be used. */
  abstract findLatest(phone: string, purpose: CodePurpose): Promise<VerificationCode | undefined>;

  /** When the last code of any purpose went to this phone, so the resend throttle covers them all. */
  abstract findLastSentAt(phone: string): Promise<Date | undefined>;

  abstract create(code: VerificationCodeRecord): Promise<VerificationCode>;

  /** Returns the new count. */
  abstract addFailedAttempt(id: string): Promise<number>;

  /** False if the code was already used, so concurrent requests cannot use it twice. */
  abstract markUsed(id: string, usedAt: Date): Promise<boolean>;
}
