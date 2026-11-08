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

  /**
   * The sessions a user applies to: the event's only one, or one for each of `days` of a multi-day event. Every day
   * must take applications, or none is opened.
   */
  async open(eventId: string, days?: string[]): Promise<EventSession[]> {
    const event = await this.eventsRepository.findById(eventId);
    if (!event) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    if (event.status === 'cancelled') {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event takes no applications');
    }
    const starts = (days?.length ? [...new Set(days)] : [undefined]).map((day) => {
      const startsAt = sessionStart(event, day);
      if (!startsAt) {
        throw new DomainError(
          'INVALID_SESSION_DAY',
          day === undefined ? 'The event runs on several days; pick them' : `The event does not run on ${day}`,
        );
      }
      return startsAt;
    });
    const now = new Date();
    if (starts.some((startsAt) => sessionCutoff(event, startsAt) <= now)) {
      throw new DomainError('APPLICATIONS_CLOSED', 'A picked session no longer takes applications');
    }
    const sessions = (await this.eventSessionsRepository.findOrCreateMany(event.id, starts)).map(withCutoff);
    if (sessions.some(({ status }) => status === 'cancelled')) {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event takes no applications');
    }
    return sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getByIds(ids: string[]): Promise<Map<string, EventSession>> {
    const sessions = await this.eventSessionsRepository.findByIds(ids);
    return new Map(sessions.map((session) => [session.id, withCutoff(session)]));
  }
}

function withCutoff({ event, ...session }: EventSessionRecord): EventSession {
  return { ...session, cutoffAt: sessionCutoff(event, new Date(session.startsAt)).toISOString() };
}
