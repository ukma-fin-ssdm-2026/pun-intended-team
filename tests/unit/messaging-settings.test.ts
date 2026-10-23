// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadMessagingSettings } from '../../dist/infra/messaging/messaging-settings.js';

describe('loadMessagingSettings', () => {
  test('logs codes to the console by default outside production', () => {
    assert.deepEqual(loadMessagingSettings({ NODE_ENV: 'development' }), { provider: 'console' });
  });

  test('sends through Telegram by default in production', () => {
    const settings = loadMessagingSettings({ NODE_ENV: 'production', TELEGRAM_GATEWAY_TOKEN: 'telegram-token' });

    assert.deepEqual(settings, { provider: 'telegram', telegramToken: 'telegram-token' });
  });

  test('adds TurboSMS as the fallback when its token and sender are set', () => {
    const settings = loadMessagingSettings({
      MESSAGING_PROVIDER: 'telegram',
      TELEGRAM_GATEWAY_TOKEN: 'telegram-token',
      TURBOSMS_TOKEN: 'sms-token',
      TURBOSMS_SENDER: 'Nearby',
    });

    assert.deepEqual(settings, {
      provider: 'telegram',
      telegramToken: 'telegram-token',
      turboSms: { token: 'sms-token', sender: 'Nearby' },
    });
  });

  test('keeps the console in production only when test adapters are allowed', () => {
    const env = { NODE_ENV: 'production', MESSAGING_PROVIDER: 'console', ALLOW_TEST_ADAPTERS: 'true' };

    assert.deepEqual(loadMessagingSettings(env), { provider: 'console' });
  });

  const refused = [
    {
      title: 'refuses Telegram without its token',
      env: { MESSAGING_PROVIDER: 'telegram' },
      error: /TELEGRAM_GATEWAY_TOKEN/,
    },
    {
      title: 'refuses a TurboSMS token without a sender',
      env: { MESSAGING_PROVIDER: 'telegram', TELEGRAM_GATEWAY_TOKEN: 't', TURBOSMS_TOKEN: 's' },
      error: /TURBOSMS_SENDER/,
    },
    { title: 'refuses an unknown provider', env: { MESSAGING_PROVIDER: 'pigeon' }, error: /MESSAGING_PROVIDER/ },
    {
      title: 'refuses the console in production, where it would log the codes',
      env: { NODE_ENV: 'production', MESSAGING_PROVIDER: 'console' },
      error: /MESSAGING_PROVIDER=console/,
    },
  ];

  for (const { title, env, error } of refused) {
    test(title, () => {
      assert.throws(() => loadMessagingSettings(env), error);
    });
  }
});
