// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { EventSessionRecord, OpenedSession } from '../types/event-session.ts';

export abstract class EventSessionsRepository {
  /**
   * The event's sessions at these starts, created if they do not exist yet; safe to call concurrently. Of two calls
   * at once, only the one that inserts a session marks it `created`.
   */
  abstract findOrCreateMany(
    eventId: string,
    starts: Date[],
    tx?: Transaction,
  ): Promise<OpenedSession<EventSessionRecord>[]>;

  abstract findByIds(ids: string[]): Promise<EventSessionRecord[]>;
}
