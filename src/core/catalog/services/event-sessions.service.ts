// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { CATALOG_WINDOW_DAYS, catalogWindow } from '../../common/catalog-window.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import type { Transaction } from '../../common/transaction.ts';
import { EventSessionsRepository } from '../repositories/event-sessions.repository.ts';
import { EventsRepository } from '../repositories/events.repository.ts';
import type { EventSession, EventSessionRecord, SessionChanges } from '../types/event-session.ts';
import { sessionAhead, sessionCutoff, sessionStart } from './session-start.ts';

@Injectable()
export class EventSessionsService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly eventSessionsRepository: EventSessionsRepository,
  ) {}

  /**
   * The sessions a user applies to: the event's only one, or one for each of `days` of a multi-day event. Every day
   * must take applications and lie within the catalog window, or none is opened: a run of shows until May takes
   * applications for the coming four weeks only.
   */
  async open(eventId: string, days?: string[]): Promise<EventSession[]> {
    const event = await this.eventsRepository.findById(eventId);
    if (!event) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    if (event.status === 'cancelled') {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event takes no applications');
    }
    const now = new Date();
    const lastDay = catalogWindow(now).to;
    const starts = (days?.length ? [...new Set(days)] : [undefined]).map((day) => {
      if (day !== undefined && day > lastDay) {
        throw new DomainError(
          'INVALID_SESSION_DAY',
          `Days can be picked at most ${CATALOG_WINDOW_DAYS} days ahead, until ${lastDay}`,
        );
      }
      const startsAt = sessionStart(event, day);
      if (!startsAt) {
        throw new DomainError(
          'INVALID_SESSION_DAY',
          day === undefined ? 'The event runs on several days; pick them' : `The event does not run on ${day}`,
        );
      }
      return startsAt;
    });
    if (starts.some((startsAt) => sessionCutoff(event, startsAt) <= now)) {
      throw new DomainError('APPLICATIONS_CLOSED', 'A picked session no longer takes applications');
    }
    const sessions = (await this.eventSessionsRepository.findOrCreateMany(event.id, starts)).map(withCutoff);
    if (sessions.some(({ status }) => status === 'cancelled')) {
      throw new DomainError('EVENT_CANCELLED', 'A cancelled event takes no applications');
    }
    return sessions.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getByIds(ids: string[], tx?: Transaction): Promise<Map<string, EventSession>> {
    const sessions = await this.eventSessionsRepository.findByIds(ids, tx);
    return new Map(sessions.map((session) => [session.id, withCutoff(session)]));
  }

  /**
   * Brings the event's sessions that are still ahead in line with the event as it is now, and says what changed
   * (matching.md, rule 10). A cancelled event has them cancelled. A published one keeps a session that still starts
   * when the event does on its day, moves one whose day now starts at another time, cancels one whose day the event
   * no longer has, and schedules again a cancelled one it has. Past sessions are left as they are, and so is
   * everything on a second call.
   */
  async reconcile(eventId: string, tx: Transaction, now = new Date()): Promise<SessionChanges> {
    const changes: SessionChanges = { cancelled: [], moved: [], reopened: [] };
    const event = await this.eventsRepository.findById(eventId, tx);
    if (!event) {
      return changes;
    }
    changes.eventStatus = event.status;
    const sessions = await this.eventSessionsRepository.findByEvent(eventId, tx);
    const byStart = new Map(sessions.map((session) => [Date.parse(session.startsAt), session]));
    for (const session of sessions) {
      const start = new Date(session.startsAt);
      if (!sessionAhead(event, start, now)) {
        continue;
      }
      const target = event.status === 'cancelled' ? undefined : sessionStart(event, kyivDate(start));
      const kept = target?.getTime() === start.getTime();
      if (session.status === 'cancelled') {
        if (kept) {
          changes.reopened.push(session.id);
        }
      } else if (!target) {
        changes.cancelled.push({ sessionId: session.id, startsAt: session.startsAt });
      } else if (!kept) {
        const existing = byStart.get(target.getTime());
        byStart.set(target.getTime(), existing ?? session);
        changes.moved.push({
          sessionId: session.id,
          from: session.startsAt,
          to: target.toISOString(),
          ...(existing && { intoSessionId: existing.id }),
        });
      }
    }

    const merged = changes.moved.filter(({ intoSessionId }) => intoSessionId !== undefined);
    const noLongerHeld = [...changes.cancelled, ...merged].map(({ sessionId }) => sessionId);
    if (noLongerHeld.length > 0) {
      await this.eventSessionsRepository.setStatus(noLongerHeld, 'cancelled', tx);
    }
    // A cancelled session that takes a moved one's place is scheduled again with it.
    const scheduledAgain = [...changes.reopened, ...merged.map(({ intoSessionId }) => intoSessionId!)];
    if (scheduledAgain.length > 0) {
      await this.eventSessionsRepository.setStatus([...new Set(scheduledAgain)], 'scheduled', tx);
    }
    for (const { sessionId, to, intoSessionId } of changes.moved) {
      if (intoSessionId === undefined) {
        await this.eventSessionsRepository.move(sessionId, new Date(to), tx);
      }
    }
    return changes;
  }
}

function withCutoff({ event, ...session }: EventSessionRecord): EventSession {
  return { ...session, cutoffAt: sessionCutoff(event, new Date(session.startsAt)).toISOString() };
}
