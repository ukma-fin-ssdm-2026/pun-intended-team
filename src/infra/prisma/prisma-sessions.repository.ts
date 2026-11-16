// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { SessionsRepository } from '../../core/identity/repositories/sessions.repository.ts';
import type { AccountStatus } from '../../core/identity/types/account.ts';
import type { Session, SessionRecord, SessionRotation } from '../../core/identity/types/session.ts';
import type { RefreshToken } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

const withAccountStatus = { account: { select: { status: true } } } as const;

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: SessionRecord): Promise<Session> {
    return toSession(await this.prisma.refreshToken.create({ data: session, include: withAccountStatus }));
  }

  async findById(id: string): Promise<Session | undefined> {
    const row = await this.prisma.refreshToken.findUnique({ where: { id }, include: withAccountStatus });
    return row ? toSession(row) : undefined;
  }

  async rotate(id: string, currentHash: string, next: SessionRotation): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, tokenHash: currentHash, revokedAt: null },
      data: next,
    });
    return count === 1;
  }

  async revoke(id: string, revokedAt: Date, tx?: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt } });
  }

  async revokeAll(accountId: string, revokedAt: Date, exceptId?: string, tx?: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).refreshToken.updateMany({
      where: { accountId, revokedAt: null, ...(exceptId && { NOT: { id: exceptId } }) },
      data: { revokedAt },
    });
  }
}

function toSession({
  id,
  accountId,
  tokenHash,
  previousTokenHash,
  rotatedAt,
  expiresAt,
  revokedAt,
  account,
}: RefreshToken & { account: { status: AccountStatus } }): Session {
  return {
    id,
    accountId,
    tokenHash,
    previousTokenHash,
    rotatedAt,
    expiresAt,
    revokedAt,
    accountStatus: account.status,
  };
}
