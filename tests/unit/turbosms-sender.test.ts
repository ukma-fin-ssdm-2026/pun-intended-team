// Written with the help of Claude
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { TurboSmsSender } from '../../dist/infra/messaging/turbosms-sender.js';
import { PHONE } from './fixtures/accounts.ts';
import { startFakeProvider } from './fixtures/fake-provider.ts';

const TOKEN = 'turbosms-test-token';
const SENDER = 'Nearby';
const CODE = '123456';

let turboSms: Awaited<ReturnType<typeof startFakeProvider>> | undefined;

afterEach(async () => {
  await turboSms?.close();
});

describe('TurboSmsSender', () => {
  test('sends the code from our sender to the number without + and returns the message id', async () => {
    turboSms = await startFakeProvider(() => ({
      body: {
        response_code: 800,
        response_status: 'SUCCESS_MESSAGE_ACCEPTED',
        response_result: [{ phone: PHONE.slice(1), response_code: 0, message_id: 'message-1', response_status: 'OK' }],
      },
    }));
    const sender = new TurboSmsSender(TOKEN, SENDER, turboSms.baseUrl);

    const messageId = await sender.send(PHONE, CODE);

    assert.equal(messageId, 'message-1');
    const [request] = turboSms.received;
    assert.equal(request?.path, '/message/send.json');
    assert.equal(request?.authorization, `Bearer ${TOKEN}`);
    const body = request?.body as { recipients: string[]; sms: { sender: string; text: string } };
    assert.deepEqual(body.recipients, [PHONE.slice(1)]);
    assert.equal(body.sms.sender, SENDER);
    assert.match(body.sms.text, new RegExp(CODE));
  });

  test('throws with the recipient status when TurboSMS refuses the number', async () => {
    turboSms = await startFakeProvider(() => ({
      body: {
        response_code: 802,
        response_status: 'SUCCESS_MESSAGE_PARTIAL_ACCEPTED',
        response_result: [{ response_code: 404, message_id: null, response_status: 'NOT_ALLOWED_NUMBER_STOPLIST' }],
      },
    }));
    const sender = new TurboSmsSender(TOKEN, SENDER, turboSms.baseUrl);

    await assert.rejects(sender.send(PHONE, CODE), /NOT_ALLOWED_NUMBER_STOPLIST/);
  });

  test('throws with the request status when TurboSMS refuses the whole request', async () => {
    turboSms = await startFakeProvider(() => ({
      body: { response_code: 203, response_status: 'REQUIRED_BALANCE', response_result: null },
    }));
    const sender = new TurboSmsSender(TOKEN, SENDER, turboSms.baseUrl);

    await assert.rejects(sender.send(PHONE, CODE), /REQUIRED_BALANCE/);
  });
});
