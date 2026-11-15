// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { MessagingProvider } from '../../dist/core/notifications/adapters/messaging-provider.js';
import { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { NewNotification } from '../../dist/core/notifications/types/notification.js';
import { PrismaNotificationsRepository } from '../../dist/infra/prisma/prisma-notifications.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';

const NOTIFICATION: NewNotification = {
  accountId: ACCOUNT_ID,
  type: 'event_changed',
  payload: { eventId: 'e0000000-0000-4000-8000-000000000001', change: 'cancelled' },
  dedupeKey: 'event_changed:cancelled:a9000000-0000-4000-8000-000000000001',
};

/** A Prisma client whose `notification.createMany` writes `count` rows. */
function aClient(count: number) {
  return {
    notification: {
      createMany: mock.fn<(args: unknown) => Promise<{ count: number }>>(() => Promise.resolve({ count })),
    },
  };
}

describe('NotificationsService.notify', () => {
  for (const { name, count, written } of [
    { name: 'writes the inbox row in the transaction, not to be pushed', count: 1, written: true },
    { name: 'writes nothing when the user was already told', count: 0, written: false },
  ]) {
    test(name, async () => {
      const outside = aClient(1);
      const inside = aClient(count);
      const repository = new PrismaNotificationsRepository(outside as unknown as PrismaService);
      const service = new NotificationsService({} as MessagingProvider, repository);

      assert.equal(await service.notify(NOTIFICATION, inside as unknown as Transaction), written);

      assert.equal(outside.notification.createMany.mock.callCount(), 0);
      assert.deepEqual(inside.notification.createMany.mock.calls[0]?.arguments[0], {
        data: [{ ...NOTIFICATION, pushStatus: 'skipped' }],
        skipDuplicates: true,
      });
    });
  }

  test('without a transaction the repository writes on its own connection', async () => {
    const outside = aClient(1);
    const repository = new PrismaNotificationsRepository(outside as unknown as PrismaService);

    assert.equal(await repository.createOnce(NOTIFICATION), true);
    assert.equal(outside.notification.createMany.mock.callCount(), 1);
  });
});
