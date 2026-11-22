// Written with the help of Claude
import { Injectable, Logger } from '@nestjs/common';
import { EventSessionsService } from '../../catalog/services/event-sessions.service.ts';
import type { EventSession } from '../../catalog/types/event-session.ts';
import { DomainError } from '../../common/domain-error.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { ApplicationsRepository } from '../repositories/applications.repository.ts';
import type { Application, ApplicationDetails, ApplicationStatus, NewApplication } from '../types/application.ts';
import { canApply } from './application-status.ts';
import { MatchingService } from './matching.service.ts';
import { nextRoundAt } from './rounds.ts';

const ACTIVE: ApplicationStatus[] = ['in_pool', 'paired', 'paused'];
const WITHDRAWABLE: ApplicationStatus[] = ['in_pool', 'paused', 'paired'];

@Injectable()
export class ApplicationsService {
  readonly #logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly eventSessionsService: EventSessionsService,
    private readonly profilesService: ProfilesService,
    private readonly matchingService: MatchingService,
    private readonly transactions: TransactionRunner,
  ) {}

  /**
   * Puts the user in the pool of the event for the days they can go (UC-001 steps 2–5), and proposes a match at once
   * when an exceptionally good partner is waiting (rule 1).
   */
  async apply(userId: string, input: NewApplication): Promise<ApplicationDetails> {
    // Checked before the sessions are opened, so an incomplete profile never creates one.
    if (!(await this.profilesService.isComplete(userId))) {
      throw new DomainError('PROFILE_INCOMPLETE', 'Complete the profile before asking for a match');
    }
    // Checked before the sessions are opened too, so a refused second application leaves no empty session.
    const existing = await this.applicationsRepository.findByUserAndEvent(userId, input.eventId);
    if (!canApply(existing.map((application) => application.status))) {
      throw new DomainError('ALREADY_APPLIED', 'The user is already in the pool of this event');
    }
    // The sessions, the application and the rounds of new sessions commit together.
    const { application, sessions } = await this.transactions.run(async (tx) => {
      const sessions = await this.eventSessionsService.open(input.eventId, input.dates, tx);
      const application = await this.applicationsRepository.create(
        {
          userId,
          eventId: input.eventId,
          sessionIds: sessions.map(({ id }) => id),
          desiredCompany: input.desiredCompany,
          afterEventPlans: input.afterEventPlans,
          preferredGender: input.preferredGender,
          ageMin: input.ageMin,
          ageMax: input.ageMax,
        },
        tx,
      );
      await this.matchingService.scheduleRounds(sessions, tx);
      return { application, sessions };
    });
    const paired = await this.matchAtOnce(application);
    return withSessions(
      paired ? { ...application, status: 'paired' } : application,
      new Map(sessions.map((session) => [session.id, session])),
    );
  }

  /** The user's active applications, and those with no match until the user dismisses them; soonest first day first. */
  async listMine(userId: string): Promise<ApplicationDetails[]> {
    const applications = await this.applicationsRepository.findListed(userId, ACTIVE);
    const sessions = await this.eventSessionsService.getByIds(applications.flatMap(({ sessionIds }) => sessionIds));
    return applications
      .map((application) => withSessions(application, sessions))
      .sort((a, b) => firstStart(a).localeCompare(firstStart(b)));
  }

  async getOwn(userId: string, id: string): Promise<ApplicationDetails> {
    return this.withSessionOf(await this.requireOwn(userId, id));
  }

  /**
   * Takes the user out of the pool (FR-031), with a pending proposal (A5); withdrawing again changes nothing. An
   * application with a mutual match stays.
   */
  async withdraw(userId: string, id: string): Promise<ApplicationDetails> {
    const application = await this.requireOwn(userId, id);
    const withdrawn =
      application.status === 'withdrawn'
        ? application
        : WITHDRAWABLE.includes(application.status) && (await this.matchingService.withdraw(application, WITHDRAWABLE));
    if (!withdrawn) {
      throw new DomainError('CONFLICT', 'Only an application waiting in the pool or for an answer can be withdrawn');
    }
    return this.withSessionOf(withdrawn);
  }

  /** Takes an application with no match out of the user's list (FR-018); dismissing it again changes nothing. */
  async dismiss(userId: string, id: string): Promise<ApplicationDetails> {
    const application = await this.requireOwn(userId, id);
    if (!(await this.applicationsRepository.dismiss(application.id))) {
      throw new DomainError('CONFLICT', 'Only an application that found no match can be dismissed');
    }
    return this.withSessionOf(application);
  }

  /**
   * The application is in the pool whatever comes of this: a failure leaves it there for the next round, and the user
   * is not told to apply again, which would be refused.
   */
  private async matchAtOnce(application: Application): Promise<boolean> {
    try {
      return await this.matchingService.matchOnApply(application);
    } catch (error) {
      this.#logger.error(`Instant match for application ${application.id} failed`, error);
      return false;
    }
  }

  /** Someone else's application is reported missing. */
  private async requireOwn(userId: string, id: string): Promise<Application> {
    const application = await this.applicationsRepository.findById(id);
    if (!application || application.userId !== userId) {
      throw new DomainError('NOT_FOUND', 'Application not found');
    }
    return application;
  }

  private async withSessionOf(application: Application): Promise<ApplicationDetails> {
    return withSessions(application, await this.eventSessionsService.getByIds(application.sessionIds));
  }
}

function withSessions(
  { sessionIds, ...application }: Application,
  allSessions: Map<string, EventSession>,
): ApplicationDetails {
  const sessions = sessionIds.map((id) => required(allSessions.get(id))).sort(byStart);
  const rounds =
    application.status === 'in_pool'
      ? sessions.flatMap(({ startsAt }) => nextRoundAt(startsAt) ?? []).sort((a, b) => a.getTime() - b.getTime())
      : [];
  return {
    ...application,
    sessions: sessions.map(({ startsAt, cutoffAt }) => ({ startsAt, cutoffAt })),
    cutoffAt:
      sessions
        .map(({ cutoffAt }) => cutoffAt)
        .sort((a, b) => a.localeCompare(b))
        .at(-1) ?? '',
    nextRoundAt: rounds[0]?.toISOString() ?? null,
  };
}

function byStart(a: EventSession, b: EventSession): number {
  return a.startsAt.localeCompare(b.startsAt);
}

function firstStart(application: ApplicationDetails): string {
  return application.sessions[0]?.startsAt ?? '';
}

/** An application always has its sessions; a missing one is a data bug, so a 500. */
function required(session: EventSession | undefined): EventSession {
  if (!session) {
    throw new Error('Application refers to a missing event session');
  }
  return session;
}
