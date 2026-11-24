// Written with the help of Claude
import type { EventSessionsRepository } from '../../../dist/core/catalog/repositories/event-sessions.repository.js';
import type { EventsRepository } from '../../../dist/core/catalog/repositories/events.repository.js';
import { EventSessionsService } from '../../../dist/core/catalog/services/event-sessions.service.js';
import type { Event } from '../../../dist/core/catalog/types/event.js';
import type { EventSessionRecord, SessionStatus } from '../../../dist/core/catalog/types/event-session.js';
import { EVENT_ID } from './catalog.ts';

export interface StoredSession {
  id: string;
  startsAt: string;
  status: SessionStatus;
}

/** A session at a time written with its Kyiv offset. */
export function sessionAt(kyivTime: string, id: string, status: SessionStatus = 'scheduled'): StoredSession {
  return { id, startsAt: new Date(kyivTime).toISOString(), status };
}

/** "id status start" of each session, for comparing what is stored. */
export function sessionStates(sessions: StoredSession[]): string[] {
  return sessions.map(({ id, status, startsAt }) => `${id} ${status} ${startsAt}`);
}

/**
 * The sessions service over one event and its sessions kept in memory, so a later call sees what an earlier one did.
 * `world.event` may be replaced between calls; undefined stands for an event that does not exist.
 */
export function sessionsServiceOver(world: {
  event: Event | undefined;
  sessions: StoredSession[];
}): EventSessionsService {
  const records = (): EventSessionRecord[] =>
    world.sessions
      .map((session) => ({
        ...session,
        eventId: EVENT_ID,
        event: { startsAt: world.event?.startsAt ?? session.startsAt, endsAt: world.event?.endsAt ?? session.startsAt },
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const eventSessionsRepository: Pick<
    EventSessionsRepository,
    'findByEvent' | 'findByIds' | 'setStatus' | 'findOrCreateMany'
  > = {
    findByEvent: () => Promise.resolve(records()),
    findByIds: (ids) => Promise.resolve(records().filter(({ id }) => ids.includes(id))),
    setStatus: (ids, status) => {
      for (const session of world.sessions.filter(({ id }) => ids.includes(id))) {
        session.status = status;
      }
      return Promise.resolve();
    },
    // A new session is called "new1", "new2", … in the order they are created.
    findOrCreateMany: (_eventId, starts) => {
      const created = new Set<string>();
      for (const start of starts.map((startsAt) => startsAt.toISOString())) {
        if (!world.sessions.some(({ startsAt }) => startsAt === start)) {
          const id = `new${world.sessions.filter(({ id }) => id.startsWith('new')).length + 1}`;
          world.sessions.push({ id, startsAt: start, status: 'scheduled' });
          created.add(id);
        }
      }
      const wanted = new Set(starts.map((startsAt) => startsAt.toISOString()));
      return Promise.resolve(
        records()
          .filter(({ startsAt }) => wanted.has(startsAt))
          .map((record) => ({ ...record, created: created.has(record.id) })),
      );
    },
  };
  const eventsRepository: Pick<EventsRepository, 'findById'> = { findById: () => Promise.resolve(world.event) };
  return new EventSessionsService(
    eventsRepository as EventsRepository,
    eventSessionsRepository as EventSessionsRepository,
  );
}
