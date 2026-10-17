// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { VerificationCodesRepository } from '../../core/identity/repositories/verification-codes.repository.ts';
import type {
  CodePurpose,
  VerificationCode,
  VerificationCodeRecord,
} from '../../core/identity/types/verification-code.ts';
import { verificationCodes } from './data.ts';

@Injectable()
export class StubVerificationCodesRepository implements VerificationCodesRepository {
  async findLatest(phone: string, purpose: CodePurpose): Promise<VerificationCode | undefined> {
    return verificationCodes
      .filter((code) => code.phone === phone && code.purpose === purpose)
      .reduce<VerificationCode | undefined>(
        (latest, code) => (latest && latest.sentAt > code.sentAt ? latest : code),
        undefined,
      );
  }

  async findLastSentAt(phone: string): Promise<Date | undefined> {
    return verificationCodes
      .filter((code) => code.phone === phone)
      .reduce<Date | undefined>((latest, code) => (latest && latest > code.sentAt ? latest : code.sentAt), undefined);
  }

  async create(record: VerificationCodeRecord): Promise<VerificationCode> {
    const code: VerificationCode = { id: randomUUID(), ...record, failedAttempts: 0, usedAt: null };
    verificationCodes.push(code);
    return code;
  }

  async addFailedAttempt(id: string): Promise<number> {
    const code = this.byId(id);
    code.failedAttempts += 1;
    return code.failedAttempts;
  }

  async markUsed(id: string, usedAt: Date): Promise<boolean> {
    const code = this.byId(id);
    if (code.usedAt) {
      return false;
    }
    code.usedAt = usedAt;
    return true;
  }

  private byId(id: string): VerificationCode {
    const code = verificationCodes.find((code) => code.id === id);
    if (!code) {
      throw new Error(`Verification code ${id} does not exist`);
    }
    return code;
  }
}
