// Written with the help of Claude
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { TelegramGatewaySender } from '../../dist/infra/messaging/telegram-gateway-sender.js';
import { PHONE } from './fixtures/accounts.ts';
import { startFakeProvider } from './fixtures/fake-provider.ts';

const TOKEN = 'telegram-test-token';
const CODE = '123456';
const CODE_LIFETIME_SECONDS = 10 * 60; // SEC-008

let gateway: Awaited<ReturnType<typeof startFakeProvider>> | undefined;

afterEach(async () => {
  await gateway?.close();
});

describe('TelegramGatewaySender', () => {
  test('sends our code with the code lifetime as TTL and returns the request id', async () => {
    gateway = await startFakeProvider(() => ({ body: { ok: true, result: { request_id: 'request-1' } } }));
    const sender = new TelegramGatewaySender(TOKEN, gateway.baseUrl);

    const requestId = await sender.send(PHONE, CODE);

    assert.equal(requestId, 'request-1');
    assert.deepEqual(gateway.received, [
      {
        method: 'POST',
        path: '/sendVerificationMessage',
        authorization: `Bearer ${TOKEN}`,
        body: { phone_number: PHONE, code: CODE, ttl: CODE_LIFETIME_SECONDS },
      },
    ]);
  });

  test('throws with the gateway error when it refuses the request', async () => {
    gateway = await startFakeProvider(() => ({ status: 400, body: { ok: false, error: 'PHONE_NUMBER_INVALID' } }));
    const sender = new TelegramGatewaySender(TOKEN, gateway.baseUrl);

    await assert.rejects(sender.send(PHONE, CODE), /PHONE_NUMBER_INVALID/);
  });

  test('throws on an answer it does not understand', async () => {
    gateway = await startFakeProvider(() => ({ body: { unexpected: true } }));
    const sender = new TelegramGatewaySender(TOKEN, gateway.baseUrl);

    await assert.rejects(sender.send(PHONE, CODE));
  });
});
