// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { Logger } from '@nestjs/common';
import { FallbackMessagingProvider } from '../../dist/infra/messaging/fallback-messaging-provider.js';
import type { CodeSender } from '../../dist/infra/messaging/code-sender.js';
import { PHONE } from './fixtures/accounts.ts';

const CODE = '123456';

function aSender(channel: CodeSender['channel'], send: () => Promise<string>) {
  return { channel, send: mock.fn(send) };
}

describe('FallbackMessagingProvider', () => {
  test('uses Telegram when it takes the code', async () => {
    const telegram = aSender('telegram', () => Promise.resolve('request-1'));
    const sms = aSender('sms', () => Promise.resolve('message-1'));
    const provider = new FallbackMessagingProvider([telegram, sms]);

    const delivery = await provider.sendCode(PHONE, CODE);

    assert.deepEqual(delivery, { channel: 'telegram', providerRequestId: 'request-1' });
    assert.deepEqual(telegram.send.mock.calls[0]?.arguments, [PHONE, CODE]);
    assert.equal(sms.send.mock.callCount(), 0);
  });

  test('falls back to SMS when Telegram fails, logging why without the full number', async () => {
    const telegram = aSender('telegram', () => Promise.reject(new Error('Telegram Gateway: PHONE_NUMBER_NOT_FOUND')));
    const sms = aSender('sms', () => Promise.resolve('message-1'));
    const provider = new FallbackMessagingProvider([telegram, sms]);
    const warn = mock.method(Logger.prototype, 'warn', () => {});

    const delivery = await provider.sendCode(PHONE, CODE);

    assert.deepEqual(delivery, { channel: 'sms', providerRequestId: 'message-1' });
    assert.deepEqual(sms.send.mock.calls[0]?.arguments, [PHONE, CODE]);
    const [message] = warn.mock.calls[0]?.arguments as [string];
    assert.match(message, /PHONE_NUMBER_NOT_FOUND/);
    assert.ok(!message.includes(PHONE), message);
    warn.mock.restore();
  });

  test('falls back when a channel fails with something that is not an Error, logging what it threw', async () => {
    const reason = 'connection closed';
    const telegram = aSender('telegram', () => Promise.reject(reason));
    const sms = aSender('sms', () => Promise.resolve('message-1'));
    const provider = new FallbackMessagingProvider([telegram, sms]);
    const warn = mock.method(Logger.prototype, 'warn', () => {});

    const delivery = await provider.sendCode(PHONE, CODE);

    assert.deepEqual(delivery, { channel: 'sms', providerRequestId: 'message-1' });
    const [message] = warn.mock.calls[0]?.arguments as [string];
    assert.ok(message.includes(reason), message);
    warn.mock.restore();
  });

  test('throws when no channel takes the code', async () => {
    const telegram = aSender('telegram', () => Promise.reject(new Error('timeout')));
    const sms = aSender('sms', () => Promise.reject(new Error('REQUIRED_BALANCE')));
    const provider = new FallbackMessagingProvider([telegram, sms]);
    const warn = mock.method(Logger.prototype, 'warn', () => {});

    await assert.rejects(provider.sendCode(PHONE, CODE), /No channel took the code/);
    assert.equal(warn.mock.callCount(), 2);
    warn.mock.restore();
  });
});
