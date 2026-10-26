// Written with the help of Claude
import { z } from 'zod';
import type { CodeSender } from './code-sender.ts';

const BASE_URL = 'https://api.turbosms.ua';
// TurboSMS finishes a send even after the client gives up, so a timeout can mean a second SMS with the same code.
const TIMEOUT_MS = 10_000;

const SendResponse = z.object({
  response_status: z.string(),
  response_result: z.array(z.object({ response_status: z.string(), message_id: z.string().nullable() })).nullable(),
});

/** SMS through TurboSMS, the fallback when Telegram cannot deliver. */
export class TurboSmsSender implements CodeSender {
  readonly channel = 'sms';

  constructor(
    private readonly token: string,
    private readonly sender: string,
    private readonly baseUrl = BASE_URL,
  ) {}

  async send(phone: string, code: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/message/send.json`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        // TurboSMS takes numbers without the leading +.
        recipients: [phone.replace(/^\+/, '')],
        sms: { sender: this.sender, text: `Nearby code: ${code}. It is valid for 10 minutes.` },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = SendResponse.parse(await response.json());
    const [recipient] = body.response_result ?? [];
    if (!recipient?.message_id) {
      throw new Error(`TurboSMS: ${recipient?.response_status ?? body.response_status}`);
    }
    return recipient.message_id;
  }
}
