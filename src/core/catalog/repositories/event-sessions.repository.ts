// Written with the help of Claude
import type { EventSession } from '../types/event-session.ts';

export abstract class EventSessionsRepository {
  /** The session of the event at that start, created if it does not exist yet; safe to call concurrently. */
  abstract findOrCreate(eventId: string, startsAt: Date): Promise<EventSession>;

  abstract findByIds(ids: string[]): Promise<EventSession[]>;
}
