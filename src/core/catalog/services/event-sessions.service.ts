// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { EventSessionsRepository } from '../repositories/event-sessions.repository.ts';
import { EventsRepository } from '../repositories/events.repository.ts';
import type { EventSession, EventSessionRecord } from '../types/event-session.ts';
import { sessionCutoff, sessionStart } from './session-start.ts';

@Injectable()
export class EventSessionsService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly eventSessionsRepository: EventSessionsRepository,
  ) {}

  /** The session a user applies to: the event's only one, or the one on `day` of a multi-day event. */
  async open(eventId: string, day?: string): Promise<EventSession> {
    const event = await this.eventsRepository.findById(eventId);
    if (!event) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    if (event.status === 'cancelled') {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event takes no applications');
    }
    const startsAt = sessionStart(event, day);
    if (!startsAt) {
      throw new DomainError(
        'INVALID_SESSION_DAY',
        day === undefined ? 'The event runs on several days; pick one' : 'The event does not run on that day',
      );
    }
    if (sessionCutoff(event, startsAt) <= new Date()) {
      throw new DomainError('APPLICATIONS_CLOSED', 'The session no longer takes applications');
    }
    const session = withCutoff(await this.eventSessionsRepository.findOrCreate(event.id, startsAt));
    if (session.status === 'cancelled') {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event takes no applications');
    }
    return session;
  }

  async getByIds(ids: string[]): Promise<Map<string, EventSession>> {
    const sessions = await this.eventSessionsRepository.findByIds(ids);
    return new Map(sessions.map((session) => [session.id, withCutoff(session)]));
  }
}

function withCutoff({ event, ...session }: EventSessionRecord): EventSession {
  return { ...session, cutoffAt: sessionCutoff(event, new Date(session.startsAt)).toISOString() };
}
