// Written with the help of Claude
import type { CodeDelivery } from '../../notifications/types/code-delivery.ts';
import type {
  CodePurpose,
  CodeSendLimit,
  VerificationCode,
  VerificationCodeRecord,
} from '../types/verification-code.ts';

export abstract class VerificationCodesRepository {
  /** The code sent last to this phone for this purpose; only it can be used. */
  abstract findLatest(phone: string, purpose: CodePurpose): Promise<VerificationCode | undefined>;

  /**
   * Stores the code unless the codes of any purpose sent to this phone reach the limit; undefined if they do.
   * Checks and stores in one step, so concurrent requests cannot both send (SEC-008).
   */
  abstract createWithinLimit(code: VerificationCodeRecord, limit: CodeSendLimit): Promise<VerificationCode | undefined>;

  abstract saveDelivery(id: string, delivery: CodeDelivery): Promise<void>;

  abstract delete(id: string): Promise<void>;

  /** Counts a check of the code and returns the new count, in one step, so concurrent checks all count. */
  abstract addAttempt(id: string): Promise<number>;

  /** False if the code was already used, so concurrent requests cannot use it twice. */
  abstract markUsed(id: string, usedAt: Date): Promise<boolean>;
}
