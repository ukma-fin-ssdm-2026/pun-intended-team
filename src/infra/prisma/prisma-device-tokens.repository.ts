// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { DeviceTokensRepository } from '../../core/notifications/repositories/device-tokens.repository.ts';
import type { DeviceToken } from '../../core/notifications/types/device-token.ts';
import type { DeviceToken as DeviceTokenRow, Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

@Injectable()
export class PrismaDeviceTokensRepository implements DeviceTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async register({ accountId, sessionId, pushToken, platform }: DeviceToken, tx?: Transaction): Promise<void> {
    const write = async (client: Prisma.TransactionClient) => {
      // refresh_token_id is unique: the session's previous token goes first.
      await client.deviceToken.deleteMany({ where: { refreshTokenId: sessionId, NOT: { pushToken } } });
      const data = { accountId, refreshTokenId: sessionId, platform };
      // INSERT … ON CONFLICT (push_token) DO UPDATE: a token registered again moves, without a unique violation.
      await client.deviceToken.upsert({ where: { pushToken }, create: { ...data, pushToken }, update: data });
    };
    if (tx) {
      await write(clientOf(this.prisma, tx));
    } else {
      await this.prisma.$transaction(write);
    }
  }

  async findByAccount(accountId: string, tx?: Transaction): Promise<DeviceToken[]> {
    const rows = await clientOf(this.prisma, tx).deviceToken.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toDeviceToken);
  }

  async deleteBySession(sessionId: string, tx?: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).deviceToken.deleteMany({ where: { refreshTokenId: sessionId } });
  }

  async deleteByAccount(accountId: string, exceptSessionId?: string, tx?: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).deviceToken.deleteMany({
      where: { accountId, ...(exceptSessionId && { NOT: { refreshTokenId: exceptSessionId } }) },
    });
  }

  async deleteByPushTokens(pushTokens: string[], tx?: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).deviceToken.deleteMany({ where: { pushToken: { in: pushTokens } } });
  }
}

function toDeviceToken({ accountId, refreshTokenId, pushToken, platform }: DeviceTokenRow): DeviceToken {
  return { accountId, sessionId: refreshTokenId, pushToken, platform };
}
