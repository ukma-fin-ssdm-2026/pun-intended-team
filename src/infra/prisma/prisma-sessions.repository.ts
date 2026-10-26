// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { SessionsRepository } from '../../core/identity/repositories/sessions.repository.ts';
import type { AccountStatus } from '../../core/identity/types/account.ts';
import type { Session, SessionRecord } from '../../core/identity/types/session.ts';
import type { RefreshToken } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

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

  async rotate(id: string, currentHash: string, next: Pick<Session, 'tokenHash' | 'expiresAt'>): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, tokenHash: currentHash, revokedAt: null },
      data: next,
    });
    return count === 1;
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt } });
  }

  async revokeAll(accountId: string, revokedAt: Date, exceptId?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { accountId, revokedAt: null, ...(exceptId && { NOT: { id: exceptId } }) },
      data: { revokedAt },
    });
  }
}

function toSession({
  id,
  accountId,
  tokenHash,
  expiresAt,
  revokedAt,
  account,
}: RefreshToken & { account: { status: AccountStatus } }): Session {
  return { id, accountId, tokenHash, expiresAt, revokedAt, accountStatus: account.status };
}
