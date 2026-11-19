// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '../../core/common/page.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import { NotificationsRepository } from '../../core/notifications/repositories/notifications.repository.ts';
import type {
  NewNotification,
  Notification,
  NotificationPayload,
  PushStatus,
} from '../../core/notifications/types/notification.ts';
import type { Notification as NotificationRow, Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(notification: NewNotification, tx?: Transaction): Promise<Notification | undefined> {
    // ON CONFLICT DO NOTHING rather than catching the unique violation, which would abort the caller's transaction.
    const [row] = await clientOf(this.prisma, tx).notification.createManyAndReturn({
      data: [{ ...notification, payload: notification.payload as Prisma.InputJsonObject }],
      skipDuplicates: true,
    });
    return row ? toNotification(row) : undefined;
  }

  async findById(id: string, tx?: Transaction): Promise<Notification | undefined> {
    const row = await clientOf(this.prisma, tx).notification.findUnique({ where: { id } });
    return row ? toNotification(row) : undefined;
  }

  async findByAccount(
    accountId: string,
    { limit, offset }: PageRequest,
    tx?: Transaction,
  ): Promise<Page<Notification>> {
    const rows = await clientOf(this.prisma, tx).notification.findMany({
      where: { accountId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toNotification),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async markRead(accountId: string, id: string, tx?: Transaction): Promise<Notification | undefined> {
    const client = clientOf(this.prisma, tx);
    await client.notification.updateMany({ where: { id, accountId, readAt: null }, data: { readAt: new Date() } });
    const row = await client.notification.findFirst({ where: { id, accountId } });
    return row ? toNotification(row) : undefined;
  }

  async updatePushStatus(id: string, from: PushStatus, to: PushStatus, tx?: Transaction): Promise<boolean> {
    const { count } = await clientOf(this.prisma, tx).notification.updateMany({
      where: { id, pushStatus: from },
      data: { pushStatus: to },
    });
    return count > 0;
  }
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.type,
    payload: row.payload as NotificationPayload,
    pushStatus: row.pushStatus,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
