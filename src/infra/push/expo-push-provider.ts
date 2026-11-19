// Written with the help of Claude
import { z } from 'zod';
import type { PushProvider } from '../../core/notifications/adapters/push-provider.ts';
import { PUSH_BATCH_LIMIT, type PushMessage, type PushTicket } from '../../core/notifications/types/push.ts';

const BASE_URL = 'https://exp.host';
// The job is retried when Expo does not answer, so there is no reason to wait long.
const TIMEOUT_MS = 10_000;

const ExpoTicket = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok') }),
  z.object({ status: z.literal('error'), details: z.object({ error: z.string().optional() }).optional() }),
]);

const SendResponse = z.object({ data: z.array(ExpoTicket) });

/**
 * Expo Push (EXT-02), without an access token: the project does not turn on Expo's push security. Expo hands the
 * messages to FCM, which needs the project's FCM key in EAS; receipts are not read.
 */
export class ExpoPushProvider implements PushProvider {
  constructor(private readonly baseUrl = BASE_URL) {}

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    if (messages.length === 0) {
      return [];
    }
    if (messages.length > PUSH_BATCH_LIMIT) {
      throw new Error(`Expo Push: ${messages.length} messages, at most ${PUSH_BATCH_LIMIT} in one request`);
    }
    const response = await fetch(`${this.baseUrl}/--/api/v2/push/send`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Expo Push: HTTP ${response.status}`);
    }
    const { data } = SendResponse.parse(await response.json());
    if (data.length !== messages.length) {
      throw new Error(`Expo Push: ${data.length} tickets for ${messages.length} messages`);
    }
    return data.map(toTicket);
  }
}

function toTicket(ticket: z.infer<typeof ExpoTicket>): PushTicket {
  if (ticket.status === 'ok') {
    return { status: 'ok' };
  }
  const error = ticket.details?.error;
  return error === undefined ? { status: 'error' } : { status: 'error', error };
}
