// Written with the help of Claude
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import type { PushMessage } from '../../dist/core/notifications/types/push.js';
import { ExpoPushProvider } from '../../dist/infra/push/expo-push-provider.js';
import { startFakeProvider } from './fixtures/fake-provider.ts';

const SEND_PATH = '/--/api/v2/push/send';

const messages: PushMessage[] = [
  { to: 'ExponentPushToken[phone]', body: 'Перше', data: { notificationId: 'n-1' } },
  { to: 'ExponentPushToken[tablet]', body: 'Друге', data: { notificationId: 'n-1' } },
];

let expo: Awaited<ReturnType<typeof startFakeProvider>> | undefined;

afterEach(async () => {
  await expo?.close();
});

async function providerAnswering(reply: { status?: number; body: unknown }) {
  expo = await startFakeProvider(() => reply);
  return new ExpoPushProvider(expo.baseUrl);
}

describe('ExpoPushProvider.send', () => {
  test('posts the messages in one request, without credentials', async () => {
    const provider = await providerAnswering({
      body: {
        data: [
          { status: 'ok', id: 't-1' },
          { status: 'ok', id: 't-2' },
        ],
      },
    });

    await provider.send(messages);

    assert.deepEqual(expo?.received, [{ method: 'POST', path: SEND_PATH, authorization: undefined, body: messages }]);
  });

  test('gives an ok ticket for each message Expo accepted', async () => {
    const provider = await providerAnswering({
      body: {
        data: [
          { status: 'ok', id: 't-1' },
          { status: 'ok', id: 't-2' },
        ],
      },
    });

    const tickets = await provider.send(messages);

    assert.deepEqual(tickets, [{ status: 'ok' }, { status: 'ok' }]);
  });

  test('gives the error code of a refused message from its details', async () => {
    const provider = await providerAnswering({
      body: {
        data: [
          { status: 'ok', id: 't-1' },
          {
            status: 'error',
            message: '"ExponentPushToken[tablet]" is not a registered push notification recipient',
            details: { error: 'DeviceNotRegistered' },
          },
        ],
      },
    });

    const tickets = await provider.send(messages);

    assert.deepEqual(tickets, [{ status: 'ok' }, { status: 'error', error: 'DeviceNotRegistered' }]);
  });

  test('gives an error without a code when the refused message has no details', async () => {
    const provider = await providerAnswering({
      body: {
        data: [
          { status: 'error', message: 'Something went wrong' },
          { status: 'ok', id: 't-2' },
        ],
      },
    });

    const tickets = await provider.send(messages);

    assert.deepEqual(tickets, [{ status: 'error' }, { status: 'ok' }]);
  });

  for (const status of [500, 503]) {
    test(`throws on HTTP ${status}, so the job is tried again`, async () => {
      const provider = await providerAnswering({ status, body: { errors: [{ code: 'INTERNAL_SERVER_ERROR' }] } });

      await assert.rejects(provider.send(messages), new RegExp(`HTTP ${status}`));
    });
  }

  const unexpected = [
    { title: 'an answer without data', body: { unexpected: true } },
    { title: 'a ticket of an unknown status', body: { data: [{ status: 'maybe' }, { status: 'ok', id: 't-2' }] } },
    { title: 'fewer tickets than messages', body: { data: [{ status: 'ok', id: 't-1' }] } },
  ];

  for (const { title, body } of unexpected) {
    test(`throws on ${title}`, async () => {
      const provider = await providerAnswering({ body });

      await assert.rejects(provider.send(messages));
    });
  }
});
