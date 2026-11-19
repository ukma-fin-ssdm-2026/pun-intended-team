// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { DomainError } from '../../dist/core/common/domain-error.js';
import type { Transaction } from '../../dist/core/common/transaction.js';
import type { JobQueue } from '../../dist/core/jobs/adapters/job-queue.js';
import type { MessagingProvider } from '../../dist/core/notifications/adapters/messaging-provider.js';
import type { PushProvider } from '../../dist/core/notifications/adapters/push-provider.js';
import type { DeviceTokensRepository } from '../../dist/core/notifications/repositories/device-tokens.repository.js';
import type { NotificationsRepository } from '../../dist/core/notifications/repositories/notifications.repository.js';
import { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import type { DeviceToken } from '../../dist/core/notifications/types/device-token.js';
import type { Notification, PushStatus } from '../../dist/core/notifications/types/notification.js';
import type { PushMessage, PushTicket } from '../../dist/core/notifications/types/push.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';

const TX = {} as Transaction;
const NOTIFICATION_ID = 'b0000000-0000-4000-8000-000000000001';
const SESSION_ID = 'b0000000-0000-4000-8000-000000000002';
const OTHER_SESSION_ID = 'b0000000-0000-4000-8000-000000000003';
const DEDUPE_KEY = 'report_received:c0000000-0000-4000-8000-000000000001';
const DELIVER_JOB = 'notifications.deliver';
const PHONE_TOKEN = 'ExponentPushToken[phone]';
const TABLET_TOKEN = 'ExponentPushToken[tablet]';
// HLD I5: Expo takes at most 100 messages in one request.
const PUSH_BATCH_LIMIT = 100;

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

function aDevice(pushToken: string, overrides: Partial<DeviceToken> = {}): DeviceToken {
  return { accountId: ACCOUNT_ID, sessionId: SESSION_ID, pushToken, platform: 'android', ...overrides };
}

const ok: PushTicket = { status: 'ok' };
const notRegistered: PushTicket = { status: 'error', error: 'DeviceNotRegistered' };

/** The handler of `notifications.deliver`, as the queue calls it. */
type DeliverHandler = (job: { id: string; name: string; payload: { notificationId: string } }) => Promise<void>;

/** Every port of NotificationsService as a mock; the account has one device, and Expo accepts every message. */
function makeService() {
  const repository = {
    create: mock.fn((): Promise<Notification | undefined> => Promise.resolve(aNotification())),
    findById: mock.fn((): Promise<Notification | undefined> => Promise.resolve(aNotification())),
    findByAccount: mock.fn(),
    markRead: mock.fn((): Promise<Notification | undefined> => Promise.resolve(aNotification())),
    updatePushStatus: mock.fn((): Promise<boolean> => Promise.resolve(true)),
  };
  const devices = {
    register: mock.fn(() => Promise.resolve()),
    findByAccount: mock.fn((): Promise<DeviceToken[]> => Promise.resolve([aDevice(PHONE_TOKEN)])),
    deleteBySession: mock.fn(() => Promise.resolve()),
    deleteByAccount: mock.fn(() => Promise.resolve()),
    deleteByPushTokens: mock.fn(() => Promise.resolve()),
  };
  const push = {
    send: mock.fn((messages: PushMessage[]): Promise<PushTicket[]> => Promise.resolve(messages.map(() => ok))),
  };
  const jobs = { register: mock.fn(), schedule: mock.fn(), enqueue: mock.fn(() => Promise.resolve()) };
  const service = new NotificationsService(
    {} as MessagingProvider,
    repository as unknown as NotificationsRepository,
    devices as unknown as DeviceTokensRepository,
    push as unknown as PushProvider,
    jobs as unknown as JobQueue,
  );
  return { service, repository, devices, push, jobs };
}

type Mocks = ReturnType<typeof makeService>;

/** A repository holding one notification, whose push status changes as the database would. */
function withStoredNotification(repository: Mocks['repository'], pushStatus: PushStatus) {
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

function registeredHandler({ service, jobs }: Pick<Mocks, 'service' | 'jobs'>): DeliverHandler {
  service.onModuleInit();
  const call = jobs.register.mock.calls.find(({ arguments: [name] }) => name === DELIVER_JOB);
  assert.ok(call, `${DELIVER_JOB} is not registered`);
  return call.arguments[1] as unknown as DeliverHandler;
}

const deliverJob = { id: 'job-1', name: DELIVER_JOB, payload: { notificationId: NOTIFICATION_ID } };

function sentTokens(push: Mocks['push']): string[] {
  return push.send.mock.calls.flatMap(({ arguments: [messages] }) => messages.map(({ to }) => to));
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

describe('NotificationsService.registerDevice', () => {
  test('ties the push token to the account, its session and the platform', async () => {
    const { service, devices } = makeService();

    await service.registerDevice(ACCOUNT_ID, SESSION_ID, { pushToken: PHONE_TOKEN, platform: 'android' });

    assert.deepEqual(devices.register.mock.calls[0]?.arguments, [aDevice(PHONE_TOKEN)]);
  });
});

describe('NotificationsService.removeDevice', () => {
  test('removes the push token of the session, in the caller’s transaction', async () => {
    const { service, devices } = makeService();

    await service.removeDevice(SESSION_ID, TX);

    assert.deepEqual(devices.deleteBySession.mock.calls[0]?.arguments, [SESSION_ID, TX]);
  });
});

describe('NotificationsService.removeDevices', () => {
  test('removes the push tokens of every session of the account but the one given', async () => {
    const { service, devices } = makeService();

    await service.removeDevices(ACCOUNT_ID, OTHER_SESSION_ID, TX);

    assert.deepEqual(devices.deleteByAccount.mock.calls[0]?.arguments, [ACCOUNT_ID, OTHER_SESSION_ID, TX]);
  });
});

// HLD I5, notifications.md rule 2. Delivery is at-least-once (job queue, rule 2).
describe('NotificationsService: the notifications.deliver handler', () => {
  test('takes the jobs in batches, so a burst of notifications does not wait a poll for each', () => {
    const mocks = makeService();

    mocks.service.onModuleInit();

    const call = mocks.jobs.register.mock.calls.find(({ arguments: [name] }) => name === DELIVER_JOB);
    const options = call?.arguments[2] as { batchSize?: number } | undefined;
    assert.ok((options?.batchSize ?? 1) > 1, `${DELIVER_JOB} takes one job at a time`);
  });

  test('pushes the notification once to every device of the account and marks it sent', async () => {
    const mocks = makeService();
    const stored = withStoredNotification(mocks.repository, 'pending');
    mocks.devices.findByAccount.mock.mockImplementation(() =>
      Promise.resolve([aDevice(PHONE_TOKEN), aDevice(TABLET_TOKEN, { sessionId: OTHER_SESSION_ID })]),
    );

    await registeredHandler(mocks)(deliverJob);

    assert.equal(mocks.push.send.mock.callCount(), 1);
    assert.deepEqual(sentTokens(mocks.push), [PHONE_TOKEN, TABLET_TOKEN]);
    assert.equal(stored.pushStatus, 'sent');
  });

  test('says in one Ukrainian line that the report was received, and points the app at the notification', async () => {
    const mocks = makeService();
    withStoredNotification(mocks.repository, 'pending');

    await registeredHandler(mocks)(deliverJob);

    const [message] = mocks.push.send.mock.calls[0]?.arguments[0] ?? [];
    assert.ok(message);
    assert.match(message.body, /скарг/i);
    assert.doesNotMatch(message.body, /\n/);
    assert.deepEqual(message.data, { notificationId: NOTIFICATION_ID, type: 'report_received' });
  });

  test('marks it skipped and pushes nothing when the account has no device', async () => {
    const mocks = makeService();
    const stored = withStoredNotification(mocks.repository, 'pending');
    mocks.devices.findByAccount.mock.mockImplementation(() => Promise.resolve([]));

    await registeredHandler(mocks)(deliverJob);

    assert.equal(stored.pushStatus, 'skipped');
    assert.equal(mocks.push.send.mock.callCount(), 0);
  });

  test('marks it sent when one device took it and another did not', async () => {
    const mocks = makeService();
    const stored = withStoredNotification(mocks.repository, 'pending');
    mocks.devices.findByAccount.mock.mockImplementation(() =>
      Promise.resolve([aDevice(PHONE_TOKEN), aDevice(TABLET_TOKEN)]),
    );
    mocks.push.send.mock.mockImplementation(() =>
      Promise.resolve([{ status: 'error', error: 'MessageRateExceeded' }, ok]),
    );

    await registeredHandler(mocks)(deliverJob);

    assert.equal(stored.pushStatus, 'sent');
  });

  test('marks it failed when every device refused it, and does not try again', async () => {
    const mocks = makeService();
    const stored = withStoredNotification(mocks.repository, 'pending');
    mocks.push.send.mock.mockImplementation(() => Promise.resolve([{ status: 'error' }]));
    const handler = registeredHandler(mocks);

    await handler(deliverJob);
    await handler(deliverJob);

    assert.equal(stored.pushStatus, 'failed');
    assert.equal(mocks.push.send.mock.callCount(), 1);
  });

  test('removes the token of a device that is no longer registered, and only that one', async () => {
    const mocks = makeService();
    withStoredNotification(mocks.repository, 'pending');
    mocks.devices.findByAccount.mock.mockImplementation(() =>
      Promise.resolve([aDevice(PHONE_TOKEN), aDevice(TABLET_TOKEN)]),
    );
    mocks.push.send.mock.mockImplementation(() =>
      Promise.resolve([notRegistered, { status: 'error', error: 'MessageTooBig' }]),
    );

    await registeredHandler(mocks)(deliverJob);

    assert.deepEqual(mocks.devices.deleteByPushTokens.mock.calls[0]?.arguments, [[PHONE_TOKEN]]);
  });

  test('fails the job and leaves it pending when the whole request fails, and the retry sends it', async () => {
    const mocks = makeService();
    const stored = withStoredNotification(mocks.repository, 'pending');
    const handler = registeredHandler(mocks);
    mocks.push.send.mock.mockImplementationOnce(() => Promise.reject(new Error('Expo Push: HTTP 503')));

    await assert.rejects(handler(deliverJob), /HTTP 503/);
    assert.equal(stored.pushStatus, 'pending');

    await handler(deliverJob);

    assert.equal(stored.pushStatus, 'sent');
    assert.equal(mocks.push.send.mock.callCount(), 2);
  });

  test('pushes nothing when the job runs again after the notification was sent', async () => {
    const mocks = makeService();
    const stored = withStoredNotification(mocks.repository, 'pending');
    const handler = registeredHandler(mocks);
    await handler(deliverJob);

    await handler(deliverJob);

    assert.equal(stored.pushStatus, 'sent');
    assert.equal(mocks.push.send.mock.callCount(), 1);
  });

  for (const pushStatus of ['sent', 'failed', 'skipped'] as const) {
    test(`pushes nothing for a notification already ${pushStatus}`, async () => {
      const mocks = makeService();
      withStoredNotification(mocks.repository, pushStatus);

      await registeredHandler(mocks)(deliverJob);

      assert.equal(mocks.push.send.mock.callCount(), 0);
      assert.equal(mocks.repository.updatePushStatus.mock.callCount(), 0);
    });
  }

  test('does nothing for a notification that is gone', async () => {
    const mocks = makeService();
    mocks.repository.findById.mock.mockImplementation(() => Promise.resolve(undefined));

    await registeredHandler(mocks)(deliverJob);

    assert.equal(mocks.push.send.mock.callCount(), 0);
    assert.equal(mocks.repository.updatePushStatus.mock.callCount(), 0);
  });

  test(`sends at most ${PUSH_BATCH_LIMIT} messages in one request`, async () => {
    const mocks = makeService();
    withStoredNotification(mocks.repository, 'pending');
    const tokens = Array.from({ length: PUSH_BATCH_LIMIT + 1 }, (_, i) => `ExponentPushToken[${i}]`);
    mocks.devices.findByAccount.mock.mockImplementation(() => Promise.resolve(tokens.map((t) => aDevice(t))));

    await registeredHandler(mocks)(deliverJob);

    assert.deepEqual(
      mocks.push.send.mock.calls.map(({ arguments: [messages] }) => messages.length),
      [PUSH_BATCH_LIMIT, 1],
    );
    assert.deepEqual(sentTokens(mocks.push), tokens);
  });
});
