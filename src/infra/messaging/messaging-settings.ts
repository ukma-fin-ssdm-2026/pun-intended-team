// Written with the help of Claude
export type MessagingSettings =
  | { provider: 'console' }
  | { provider: 'telegram'; telegramToken: string; turboSms?: { token: string; sender: string } };

/**
 * Read at startup. Codes go to the console unless MESSAGING_PROVIDER is `telegram`, the default in production;
 * then the Telegram token is required, and TurboSMS, when configured, is the SMS fallback.
 */
export function loadMessagingSettings(env: NodeJS.ProcessEnv = process.env): MessagingSettings {
  const provider = env.MESSAGING_PROVIDER || (env.NODE_ENV === 'production' ? 'telegram' : 'console');
  if (provider === 'console') {
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
