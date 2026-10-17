// Written with the help of Claude
import { z } from 'zod';
import type { CodeSender } from './code-sender.ts';

const BASE_URL = 'https://gatewayapi.telegram.org';
// Short, so SMS still goes out in time when Telegram does not answer (SEC-008).
const TIMEOUT_MS = 3000;
// The code lifetime (SEC-008); Telegram refunds a code it could not deliver within it.
const TTL_SECONDS = 10 * 60;

const GatewayResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), result: z.object({ request_id: z.string() }) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

/** Sends our own code as an official Telegram message to the account registered with the number. */
export class TelegramGatewaySender implements CodeSender {
  readonly channel = 'telegram';

  constructor(
    private readonly token: string,
    private readonly baseUrl = BASE_URL,
  ) {}

  async send(phone: string, code: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/sendVerificationMessage`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, code, ttl: TTL_SECONDS }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = GatewayResponse.parse(await response.json());
    if (!body.ok) {
      throw new Error(`Telegram Gateway: ${body.error}`);
    }
    return body.result.request_id;
  }
}
