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
import { type MatchRecord, PENDING_STATUSES } from '../types/match.ts';
import { MatchingService } from './matching.service.ts';

/** A day of an application that changed: `to` is its new start, or null when the day is no longer on. */
interface ChangedDay {
  from: string;
  to: string | null;
}

/**
 * What a cancelled or moved event means for its applicants (HLD I3, matching.md rule 10). Consumes `event.changed`:
 * the catalog brings the sessions in line with the event, and the applications follow their sessions. An application
 * left without a day that is still ahead is cancelled with its pending proposal, whose other side returns to the pool
 * if it keeps a day; one that keeps a day loses only the days that are gone. A mutual match that lost a shared day and
 * has none left ahead is cancelled too; one whose shared day moved is kept. Every applicant whose days changed is told
 * once, with what became of their mutual match.
 */
@Injectable()
export class EventChangesService implements OnModuleInit {
  constructor(
    private readonly jobs: JobQueue,
    private readonly transactions: TransactionRunner,
    private readonly eventSessionsService: EventSessionsService,
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly matchesRepository: MatchesRepository,
    private readonly matchingService: MatchingService,
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
      // Under the event's lock, so no round or answer reads the pool while it changes (matching.md, rule 7).
      await this.matchesRepository.lockEvent(eventId, tx);
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
    const daysLeft = (application: Application) =>
      application.sessionIds.filter((id) => !gone.has(id)).map((id) => moved.get(id)?.intoSessionId ?? id);
    const mutual = await this.mutualMatchesOf(applications, tx);
    const sessions = await this.eventSessionsService.getByIds(
      [
        ...new Set([
          ...applications.flatMap(daysLeft),
          ...[...mutual.values()].flatMap(({ applicationA, applicationB }) => [
            ...daysLeft(applicationA),
            ...daysLeft(applicationB),
          ]),
        ]),
      ],
      tx,
    );
    const isAhead = (sessionId: string) => {
      const session = sessions.get(sessionId);
      return session?.status === 'scheduled' && (new Date(session.startsAt) > now || new Date(session.cutoffAt) > now);
    };
    const cancelled = new Set(
      applications.filter((application) => !daysLeft(application).some(isAhead)).map(({ id }) => id),
    );
    // The two picked one of their shared days (rule 9): the match ends when the change took one of them away and
    // leaves none ahead. A shared day that moved still counts, and a match whose days are all past is left alone.
    const ended = new Set(
      [...mutual.values()]
        .filter((match) => {
          const shared = sharedDays(match.applicationA.sessionIds, match.applicationB.sessionIds);
          const sharedLeft = sharedDays(daysLeft(match.applicationA), daysLeft(match.applicationB));
          return shared.some((id) => gone.has(id)) && !sharedLeft.some(isAhead);
        })
        .map(({ id }) => id),
    );
    const trimmed = applications.filter(
      ({ id, sessionIds }) => !cancelled.has(id) && sessionIds.some((day) => gone.has(day)),
    );

    if (cancelled.size > 0) {
      await this.applicationsRepository.cancel([...cancelled], ACTIVE_STATUSES, tx);
      await this.matchesRepository.cancelPending([...cancelled], 'event_cancelled', tx);
    }
    await this.matchesRepository.cancelMutual(
      [...mutual.values()].filter(({ id }) => ended.has(id)),
      'event_cancelled',
      tx,
    );
    // A proposal on a shared day that moved has its time limit from the old time: the two return to the pool for
    // the rounds of the new one (matching.md, rule 4).
    const voided = new Set<string>();
    for (const application of applications.filter(({ id, status }) => status === 'paired' && !cancelled.has(id))) {
      const match = await this.matchesRepository.findByApplication(application.id, PENDING_STATUSES, tx);
      if (!match || voided.has(match.id)) {
        continue;
      }
      const daysOfB = new Set(match.applicationB.sessionIds);
      if (match.applicationA.sessionIds.some((id) => daysOfB.has(id) && moved.has(id))) {
        voided.add(match.id);
        await this.matchesRepository.cancelAndReturnBoth(match, 'event_changed', tx);
      }
    }
    for (const { sessionId, intoSessionId } of changes.moved) {
      await this.applicationsRepository.moveDay(sessionId, intoSessionId, tx);
    }
    await this.matchingService.scheduleRounds(changes.movedTo, tx);
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
      const dedupeKey =
        change === 'cancelled'
          ? `event_changed:cancelled:${application.id}`
          : `event_changed:rescheduled:${application.id}:${days.map(({ from, to }) => `${from}>${to ?? 'none'}`).join(',')}`;
      const match = [...mutual.values()].find(({ applicationAId, applicationBId }) =>
        [applicationAId, applicationBId].includes(application.id),
      );
      await this.notificationsService.notify(
        application.userId,
        'event_changed',
        {
          eventId,
          applicationId: application.id,
          change,
          sessions: days,
          ...(match && { match: { id: match.id, cancelled: ended.has(match.id) } }),
        },
        dedupeKey,
        tx,
      );
    }
  }

  /** The mutual matches of the paired applications, by id; an application has at most one (data model). */
  private async mutualMatchesOf(applications: Application[], tx: Transaction): Promise<Map<string, MatchRecord>> {
    const matches = new Map<string, MatchRecord>();
    for (const { id } of applications.filter(({ status }) => status === 'paired')) {
      const match = await this.matchesRepository.findByApplication(id, ['mutual'], tx);
      if (match) {
        matches.set(match.id, match);
      }
    }
    return matches;
  }
}

function sharedDays(daysOfA: string[], daysOfB: string[]): string[] {
  const ofB = new Set(daysOfB);
  return daysOfA.filter((id) => ofB.has(id));
}
