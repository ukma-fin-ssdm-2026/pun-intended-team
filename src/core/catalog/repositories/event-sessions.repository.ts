// Written with the help of Claude
import type { EventSessionRecord } from '../types/event-session.ts';

export abstract class EventSessionsRepository {
  /** The event's sessions at these starts, created if they do not exist yet; safe to call concurrently. */
  abstract findOrCreateMany(eventId: string, starts: Date[]): Promise<EventSessionRecord[]>;

  abstract findByIds(ids: string[]): Promise<EventSessionRecord[]>;
}
