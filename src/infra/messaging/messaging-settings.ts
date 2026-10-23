// Written with the help of Claude
export type MessagingSettings =
  | { provider: 'console' }
  | { provider: 'telegram'; telegramToken: string; turboSms?: { token: string; sender: string } };

/**
 * Read at startup. Codes go to the console unless MESSAGING_PROVIDER is `telegram`, the default in production;
 * then the Telegram token is required, and TurboSMS, when configured, is the SMS fallback.
 * Production refuses the console unless ALLOW_TEST_ADAPTERS is `true`, which only the e2e tests set.
 */
export function loadMessagingSettings(env: NodeJS.ProcessEnv = process.env): MessagingSettings {
  const isProduction = env.NODE_ENV === 'production';
  const provider = env.MESSAGING_PROVIDER || (isProduction ? 'telegram' : 'console');
  if (provider === 'console') {
    if (isProduction && env.ALLOW_TEST_ADAPTERS !== 'true') {
      throw new Error('MESSAGING_PROVIDER=console would log the codes instead of sending them: not in production');
    }
    return { provider };
  }
  if (provider !== 'telegram') {
    throw new Error('MESSAGING_PROVIDER must be console or telegram');
  }
  if (!env.TELEGRAM_GATEWAY_TOKEN) {
    throw new Error('TELEGRAM_GATEWAY_TOKEN is not set: see .env.example');
  }
  if (!env.TURBOSMS_TOKEN) {
    return { provider, telegramToken: env.TELEGRAM_GATEWAY_TOKEN };
  }
  if (!env.TURBOSMS_SENDER) {
    throw new Error('TURBOSMS_SENDER is not set: the sender name activated in TurboSMS');
  }
  return {
    provider,
    telegramToken: env.TELEGRAM_GATEWAY_TOKEN,
    turboSms: { token: env.TURBOSMS_TOKEN, sender: env.TURBOSMS_SENDER },
  };
}
