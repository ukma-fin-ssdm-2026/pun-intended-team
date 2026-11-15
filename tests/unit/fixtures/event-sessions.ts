// Written with the help of Claude
import assert from 'node:assert/strict';
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
  const eventSessionsRepository: Pick<EventSessionsRepository, 'findByEvent' | 'findByIds' | 'setStatus' | 'move'> = {
    findByEvent: () => Promise.resolve(records()),
    findByIds: (ids) => Promise.resolve(records().filter(({ id }) => ids.includes(id))),
    setStatus: (ids, status) => {
      for (const session of world.sessions.filter(({ id }) => ids.includes(id))) {
        session.status = status;
      }
      return Promise.resolve();
    },
    move: (id, startsAt) => {
      const taken = world.sessions.some((session) => session.startsAt === startsAt.toISOString());
      assert.equal(taken, false, 'the event has a session at the new start already');
      world.sessions.find((session) => session.id === id)!.startsAt = startsAt.toISOString();
      return Promise.resolve();
    },
  };
  const eventsRepository: Pick<EventsRepository, 'findById'> = { findById: () => Promise.resolve(world.event) };
  return new EventSessionsService(
    eventsRepository as EventsRepository,
    eventSessionsRepository as EventSessionsRepository,
  );
}
