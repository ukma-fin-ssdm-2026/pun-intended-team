// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { NotificationsRepository } from '../../core/notifications/repositories/notifications.repository.ts';
import type { NewNotification } from '../../core/notifications/types/notification.ts';
import type { Prisma } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOnce({ payload, ...notification }: NewNotification, tx?: Transaction): Promise<boolean> {
    const client = (tx as unknown as Prisma.TransactionClient | undefined) ?? this.prisma;
    // ON CONFLICT DO NOTHING on dedupe_key: a job that runs twice tells the user once.
    const { count } = await client.notification.createMany({
      data: [{ ...notification, payload, pushStatus: 'skipped' }],
      skipDuplicates: true,
    });
    return count > 0;
  }
}
