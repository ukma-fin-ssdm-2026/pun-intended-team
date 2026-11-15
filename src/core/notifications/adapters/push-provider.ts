// Written with the help of Claude
import type { PushMessage, PushTicket } from '../types/push.ts';

/** Sends pushes to devices (HLD I5). */
export abstract class PushProvider {
  /**
   * Sends up to PUSH_BATCH_LIMIT messages in one request and gives one ticket per message, in their order. Throws
   * when the request as a whole fails, so nothing is known about any of them; a refused message is a ticket instead.
   */
  abstract send(messages: PushMessage[]): Promise<PushTicket[]>;
}
