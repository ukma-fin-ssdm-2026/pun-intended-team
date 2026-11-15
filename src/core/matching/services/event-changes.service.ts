// Written with the help of Claude
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { EventSessionsService } from '../../catalog/services/event-sessions.service.ts';
import type { SessionChanges } from '../../catalog/types/event-session.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import type { Transaction } from '../../common/transaction.ts';
import { JobQueue } from '../../jobs/adapters/job-queue.ts';
import { EVENT_CHANGED_JOB, type EventChangedPayload } from '../../jobs/types/event-changed.ts';
import { NotificationsService } from '../../notifications/services/notifications.service.ts';
import { ApplicationsRepository } from '../repositories/applications.repository.ts';
import { MatchesRepository } from '../repositories/matches.repository.ts';
import { ACTIVE_STATUSES, type Application } from '../types/application.ts';

/** A day of an application that changed: `to` is its new start, or null when the day is no longer on. */
interface ChangedDay {
  from: string;
  to: string | null;
}

/**
 * What a cancelled or moved event means for its applicants (HLD I3, matching.md rule 10). Consumes `event.changed`:
 * the catalog brings the sessions in line with the event, and the applications follow their sessions. An application
 * left without a day that is still ahead is cancelled with its open proposals; one that keeps a day loses only the
 * days that are gone. Every applicant whose days changed is told once.
 */
@Injectable()
export class EventChangesService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly transactions: TransactionRunner,
    private readonly eventSessionsService: EventSessionsService,
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly matchesRepository: MatchesRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register<EventChangedPayload>(EVENT_CHANGED_JOB, ({ payload }) => this.handle(payload));
  }

  /**
   * Safe to run twice, or late: it reads the event as it is now, whatever `change` the job names, and a second run
   * finds the sessions already in line and does nothing.
   */
  async handle({ eventId }: EventChangedPayload, now = new Date()): Promise<void> {
    await this.transactions.run(async (tx) => {
      const changes = await this.eventSessionsService.reconcile(eventId, tx, now);
      if (changes.cancelled.length > 0 || changes.moved.length > 0) {
        await this.follow(eventId, changes, now, tx);
      }
    });
  }

  private async follow(eventId: string, changes: SessionChanges, now: Date, tx: Transaction): Promise<void> {
    const gone = new Map(changes.cancelled.map(({ sessionId, startsAt }) => [sessionId, startsAt]));
    const moved = new Map(changes.moved.map((move) => [move.sessionId, move]));
    const applications = await this.applicationsRepository.findBySessions(
      [...gone.keys(), ...moved.keys()],
      ACTIVE_STATUSES,
      tx,
    );
    for (const { sessionId, intoSessionId } of changes.moved) {
      if (intoSessionId !== undefined) {
        await this.applicationsRepository.moveDay(sessionId, intoSessionId, tx);
      }
    }

    const daysLeft = (application: Application) =>
      application.sessionIds.filter((id) => !gone.has(id)).map((id) => moved.get(id)?.intoSessionId ?? id);
    const sessions = await this.eventSessionsService.getByIds([...new Set(applications.flatMap(daysLeft))], tx);
    const isAhead = (sessionId: string) => {
      const session = sessions.get(sessionId);
      return session?.status === 'scheduled' && (new Date(session.startsAt) > now || new Date(session.cutoffAt) > now);
    };
    const cancelled = new Set(
      applications.filter((application) => !daysLeft(application).some(isAhead)).map(({ id }) => id),
    );
    const trimmed = applications.filter(
      ({ id, sessionIds }) => !cancelled.has(id) && sessionIds.some((day) => gone.has(day)),
    );

    if (cancelled.size > 0) {
      await this.applicationsRepository.cancel([...cancelled], ACTIVE_STATUSES, tx);
      await this.matchesRepository.cancelOpen([...cancelled], 'event_cancelled', tx);
    }
    if (trimmed.length > 0) {
      await this.applicationsRepository.removeDays(
        trimmed.map(({ id }) => id),
        [...gone.keys()],
        tx,
      );
    }

    const change = changes.eventStatus === 'cancelled' ? 'cancelled' : 'rescheduled';
    for (const application of applications) {
      const days = application.sessionIds.flatMap((id): ChangedDay[] => {
        const goneFrom = gone.get(id);
        const move = moved.get(id);
        if (goneFrom !== undefined) {
          return [{ from: goneFrom, to: null }];
        }
        return move ? [{ from: move.from, to: move.to }] : [];
      });
      days.sort((a, b) => a.from.localeCompare(b.from));
      await this.notificationsService.notify(
        {
          accountId: application.userId,
          type: 'event_changed',
          payload: {
            eventId,
            applicationId: application.id,
            change,
            applicationStatus: cancelled.has(application.id) ? 'cancelled' : application.status,
            sessions: days,
          },
          dedupeKey:
            change === 'cancelled'
              ? `event_changed:cancelled:${application.id}`
              : `event_changed:rescheduled:${application.id}:${days.map(({ from, to }) => `${from}>${to ?? 'none'}`).join(',')}`,
        },
        tx,
      );
    }
  }
}
