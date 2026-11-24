// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { CATALOG_WINDOW_DAYS, catalogWindow } from '../../common/catalog-window.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import type { Transaction } from '../../common/transaction.ts';
import { EventSessionsRepository } from '../repositories/event-sessions.repository.ts';
import { EventsRepository } from '../repositories/events.repository.ts';
import type { EventSession, EventSessionRecord, OpenedSession, SessionChanges } from '../types/event-session.ts';
import { sessionCutoff, sessionInPlay, sessionStart } from './session-start.ts';

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
  async open(eventId: string, days?: string[], tx?: Transaction): Promise<OpenedSession[]> {
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
    const sessions = (await this.eventSessionsRepository.findOrCreateMany(event.id, starts, tx)).map(
      ({ created, ...session }) => ({ ...withCutoff(session), created }),
    );
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
   * Brings the event's sessions that are still in play (`sessionInPlay`) in line with the event as it is now, and says
   * what changed (matching.md, rule 10). A cancelled event has them cancelled. A published one keeps a session that still starts
   * when the event does on its day, moves one whose day now starts at another time, cancels one whose day the event
   * no longer has, and schedules again a cancelled one it has. Past sessions are left as they are, and so is
   * everything on a second call.
   */
  async reconcile(eventId: string, tx: Transaction, now = new Date()): Promise<SessionChanges> {
    const changes: SessionChanges = { cancelled: [], moved: [], reopened: [], movedTo: [] };
    const event = await this.eventsRepository.findById(eventId, tx);
    if (!event) {
      return changes;
    }
    changes.eventStatus = event.status;
    const sessions = await this.eventSessionsRepository.findByEvent(eventId, tx);
    const moves: { session: EventSessionRecord; to: Date }[] = [];
    for (const session of sessions) {
      const start = new Date(session.startsAt);
      if (!sessionInPlay(event, start, now)) {
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
        moves.push({ session, to: target });
      }
    }

    // A moved session's applications go to the session at the new time, a session of its own with its own rounds;
    // the one at the old time is cancelled, so its round jobs do nothing (matching.md, rule 10).
    const targets =
      moves.length > 0
        ? await this.eventSessionsRepository.findOrCreateMany(
            eventId,
            moves.map(({ to }) => to),
            tx,
          )
        : [];
    const byStart = new Map(targets.map((target) => [Date.parse(target.startsAt), target]));
    for (const { session, to } of moves) {
      const target = byStart.get(to.getTime())!;
      changes.moved.push({
        sessionId: session.id,
        from: session.startsAt,
        to: target.startsAt,
        intoSessionId: target.id,
      });
    }
    const movedTo = [...new Map(targets.map((target) => [target.id, target])).values()];
    changes.movedTo = movedTo.map(({ created, ...target }) => ({
      ...withCutoff({ ...target, status: 'scheduled' }),
      created,
    }));

    const noLongerHeld = [...changes.cancelled, ...changes.moved].map(({ sessionId }) => sessionId);
    if (noLongerHeld.length > 0) {
      await this.eventSessionsRepository.setStatus(noLongerHeld, 'cancelled', tx);
    }
    const scheduledAgain = [
      ...changes.reopened,
      ...movedTo.filter(({ status }) => status === 'cancelled').map(({ id }) => id),
    ];
    if (scheduledAgain.length > 0) {
      await this.eventSessionsRepository.setStatus([...new Set(scheduledAgain)], 'scheduled', tx);
    }
    return changes;
  }
}

function withCutoff({ event, ...session }: EventSessionRecord): EventSession {
  return { ...session, cutoffAt: sessionCutoff(event, new Date(session.startsAt)).toISOString() };
}
