// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { JobQueue } from '../../dist/core/jobs/adapters/job-queue.js';
import type { MessagingProvider } from '../../dist/core/notifications/adapters/messaging-provider.js';
import type { NotificationsRepository } from '../../dist/core/notifications/repositories/notifications.repository.js';
import { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { Notification, PushStatus } from '../../dist/core/notifications/types/notification.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';

const TX = {} as Transaction;
const NOTIFICATION_ID = 'b0000000-0000-4000-8000-000000000001';
const DEDUPE_KEY = 'report_received:c0000000-0000-4000-8000-000000000001';
const DELIVER_JOB = 'notifications.deliver';

function aNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: NOTIFICATION_ID,
    accountId: ACCOUNT_ID,
    type: 'report_received',
    payload: {},
    pushStatus: 'pending',
    readAt: null,
    createdAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  };
}

/** The handler of `notifications.deliver`, as the queue calls it. */
type DeliverHandler = (job: { id: string; name: string; payload: { notificationId: string } }) => Promise<void>;

function makeService() {
  const repository = {
    create: mock.fn((): Promise<Notification | undefined> => Promise.resolve(aNotification())),
    findById: mock.fn((): Promise<Notification | undefined> => Promise.resolve(aNotification())),
    findByAccount: mock.fn(),
    markRead: mock.fn((): Promise<Notification | undefined> => Promise.resolve(aNotification())),
    updatePushStatus: mock.fn((): Promise<boolean> => Promise.resolve(true)),
  };
  const jobs = { register: mock.fn(), schedule: mock.fn(), enqueue: mock.fn(() => Promise.resolve()) };
  const service = new NotificationsService(
    {} as MessagingProvider,
    repository as unknown as NotificationsRepository,
    jobs as unknown as JobQueue,
  );
  return { service, repository, jobs };
}

/** A repository holding one notification, whose push status changes as the database would. */
function withStoredNotification(repository: ReturnType<typeof makeService>['repository'], pushStatus: PushStatus) {
  const stored = aNotification({ pushStatus });
  repository.findById.mock.mockImplementation(() => Promise.resolve({ ...stored }));
  repository.updatePushStatus.mock.mockImplementation((...args: unknown[]) => {
    const [, from, to] = args as [string, PushStatus, PushStatus];
    if (stored.pushStatus !== from) {
      return Promise.resolve(false);
    }
    stored.pushStatus = to;
    return Promise.resolve(true);
  });
  return stored;
}

function registeredHandler(service: NotificationsService, jobs: ReturnType<typeof makeService>['jobs']) {
  service.onModuleInit();
  const call = jobs.register.mock.calls.find(({ arguments: [name] }) => name === DELIVER_JOB);
  assert.ok(call, `${DELIVER_JOB} is not registered`);
  return call.arguments[1] as unknown as DeliverHandler;
}

describe('NotificationsService.notify', () => {
  test('writes the notification and enqueues its delivery, both in the caller’s transaction', async () => {
    const { service, repository, jobs } = makeService();

    await service.notify(ACCOUNT_ID, 'report_received', {}, DEDUPE_KEY, TX);

    assert.deepEqual(repository.create.mock.calls[0]?.arguments, [
      { accountId: ACCOUNT_ID, type: 'report_received', payload: {}, dedupeKey: DEDUPE_KEY },
      TX,
    ]);
    assert.deepEqual(
      jobs.enqueue.mock.calls.map((call) => call.arguments as unknown[]),
      [[DELIVER_JOB, { notificationId: NOTIFICATION_ID }, undefined, TX]],
    );
  });

  test('enqueues nothing when a notification with the dedupe key already exists', async () => {
    const { service, repository, jobs } = makeService();
    repository.create.mock.mockImplementation(() => Promise.resolve(undefined));

    const notification = await service.notify(ACCOUNT_ID, 'report_received', {}, DEDUPE_KEY, TX);

    assert.equal(notification, undefined);
    assert.equal(jobs.enqueue.mock.callCount(), 0);
  });
});

describe('NotificationsService.markRead', () => {
  test('marks the caller’s own notification read', async () => {
    const { service, repository } = makeService();
    const read = aNotification({ readAt: '2026-11-15T11:00:00.000Z' });
    repository.markRead.mock.mockImplementation(() => Promise.resolve(read));

    const notification = await service.markRead(ACCOUNT_ID, NOTIFICATION_ID);

    assert.deepEqual(repository.markRead.mock.calls[0]?.arguments, [ACCOUNT_ID, NOTIFICATION_ID]);
    assert.equal(notification, read);
  });

  test('rejects a notification the caller does not have as NOT_FOUND', async () => {
    const { service, repository } = makeService();
    repository.markRead.mock.mockImplementation(() => Promise.resolve(undefined));

    await assert.rejects(
      service.markRead(ACCOUNT_ID, NOTIFICATION_ID),
      (error: unknown) => error instanceof DomainError && error.code === 'NOT_FOUND',
    );
  });
});

// Push is not built yet (#372): every notification is marked skipped. Delivery is at-least-once (job queue, rule 2).
describe('NotificationsService: the notifications.deliver handler', () => {
  test('marks a pending notification skipped', async () => {
    const { service, repository, jobs } = makeService();
    const stored = withStoredNotification(repository, 'pending');
    const handler = registeredHandler(service, jobs);

    await handler({ id: 'job-1', name: DELIVER_JOB, payload: { notificationId: NOTIFICATION_ID } });

    assert.equal(stored.pushStatus, 'skipped');
    assert.deepEqual(repository.updatePushStatus.mock.calls[0]?.arguments, [NOTIFICATION_ID, 'pending', 'skipped']);
  });

  test('changes nothing when the job runs again', async () => {
    const { service, repository, jobs } = makeService();
    const stored = withStoredNotification(repository, 'pending');
    const handler = registeredHandler(service, jobs);
    const job = { id: 'job-1', name: DELIVER_JOB, payload: { notificationId: NOTIFICATION_ID } };
    await handler(job);

    await handler(job);

    assert.equal(stored.pushStatus, 'skipped');
    assert.equal(repository.updatePushStatus.mock.callCount(), 1);
  });

  test('does nothing for a notification that is gone', async () => {
    const { service, repository, jobs } = makeService();
    repository.findById.mock.mockImplementation(() => Promise.resolve(undefined));
    const handler = registeredHandler(service, jobs);

    await handler({ id: 'job-1', name: DELIVER_JOB, payload: { notificationId: NOTIFICATION_ID } });

    assert.equal(repository.updatePushStatus.mock.callCount(), 0);
  });
});
