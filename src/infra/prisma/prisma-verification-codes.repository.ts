// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { VerificationCodesRepository } from '../../core/identity/repositories/verification-codes.repository.ts';
import type {
  CodePurpose,
  CodeSendLimit,
  VerificationCode,
  VerificationCodeRecord,
} from '../../core/identity/types/verification-code.ts';
import type { CodeDelivery } from '../../core/notifications/types/code-delivery.ts';
import type { VerificationCode as VerificationCodeRow } from './generated/client.ts';
import { PersonalDataCipher } from './personal-data-cipher.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaVerificationCodesRepository implements VerificationCodesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: PersonalDataCipher,
  ) {}

  async findLatest(phone: string, purpose: CodePurpose): Promise<VerificationCode | undefined> {
    const row = await this.prisma.verificationCode.findFirst({
      where: { contactHash: this.cipher.hash(phone), purpose },
      orderBy: { sentAt: 'desc' },
    });
    return row ? this.toCode(row) : undefined;
  }

  async createWithinLimit(record: VerificationCodeRecord, limit: CodeSendLimit): Promise<VerificationCode | undefined> {
    const contactHash = this.cipher.hash(record.phone);
    return this.prisma.$transaction(async (tx) => {
      // One lock per phone until the transaction ends, so concurrent requests count each other's codes.
      const lockKey = Buffer.from(contactHash).readBigInt64BE(0);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
      const sentRecently = await tx.verificationCode.count({
        where: { contactHash, sentAt: { gt: limit.noneSentAfter } },
      });
      const sentInWindow = await tx.verificationCode.count({ where: { contactHash, sentAt: { gt: limit.since } } });
      if (sentRecently > 0 || sentInWindow >= limit.atMost) {
        return undefined;
      }
      const row = await tx.verificationCode.create({
        data: {
          contact: this.cipher.encrypt(record.phone),
          contactHash,
          purpose: record.purpose,
          codeHash: record.codeHash,
          sentAt: record.sentAt,
          expiresAt: record.expiresAt,
        },
      });
      return this.toCode(row);
    });
  }

  async saveDelivery(id: string, { channel, providerRequestId }: CodeDelivery): Promise<void> {
    await this.prisma.verificationCode.update({ where: { id }, data: { channel, providerRequestId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.verificationCode.deleteMany({ where: { id } });
  }

  async addAttempt(id: string): Promise<number> {
    const { attempts } = await this.prisma.verificationCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return attempts;
  }

  async markUsed(id: string, usedAt: Date): Promise<boolean> {
    const { count } = await this.prisma.verificationCode.updateMany({ where: { id, usedAt: null }, data: { usedAt } });
    return count === 1;
  }

  private toCode(row: VerificationCodeRow): VerificationCode {
    return {
      id: row.id,
      phone: this.cipher.decrypt(row.contact),
      purpose: row.purpose,
      codeHash: row.codeHash,
      channel: row.channel,
      providerRequestId: row.providerRequestId,
      sentAt: row.sentAt,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      usedAt: row.usedAt,
    };
  }
}
