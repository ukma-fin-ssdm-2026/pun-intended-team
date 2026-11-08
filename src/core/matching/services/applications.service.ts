// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventSessionsService } from '../../catalog/services/event-sessions.service.ts';
import type { EventSession } from '../../catalog/types/event-session.ts';
import { DomainError } from '../../common/domain-error.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { ApplicationsRepository } from '../repositories/applications.repository.ts';
import type { Application, ApplicationDetails, ApplicationStatus, NewApplication } from '../types/application.ts';
import { canApply } from './application-status.ts';
import { nextRoundAt } from './rounds.ts';

const ACTIVE: ApplicationStatus[] = ['in_pool', 'paired', 'paused'];
// A paired application is withdrawn with its proposal, which comes with the proposals themselves.
const WITHDRAWABLE: ApplicationStatus[] = ['in_pool', 'paused'];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly eventSessionsService: EventSessionsService,
    private readonly profilesService: ProfilesService,
  ) {}

  /** Puts the user in the pool of the event's session (UC-001 steps 2–5). */
  async apply(userId: string, input: NewApplication): Promise<ApplicationDetails> {
    // Checked before the session is opened, so an incomplete profile never creates one.
    if (!(await this.profilesService.isComplete(userId))) {
      throw new DomainError('PROFILE_INCOMPLETE', 'Complete the profile before asking for a match');
    }
    const session = await this.eventSessionsService.open(input.eventId, input.date);
    const existing = await this.applicationsRepository.findByUserAndSession(userId, session.id);
    if (!canApply(existing.map((application) => application.status))) {
      throw new DomainError('ALREADY_APPLIED', 'The user is already in the pool of this session');
    }
    const application = await this.applicationsRepository.create({
      userId,
      sessionId: session.id,
      desiredCompany: input.desiredCompany,
      afterEventPlans: input.afterEventPlans,
    });
    return withSession(application, session);
  }

  /** The user's active applications, soonest session first. */
  async listMine(userId: string): Promise<ApplicationDetails[]> {
    const applications = await this.applicationsRepository.findByUserWithStatus(userId, ACTIVE);
    const sessions = await this.eventSessionsService.getByIds(applications.map(({ sessionId }) => sessionId));
    return applications
      .map((application) => withSession(application, required(sessions.get(application.sessionId))))
      .sort((a, b) => a.sessionStartsAt.localeCompare(b.sessionStartsAt));
  }

  async getOwn(userId: string, id: string): Promise<ApplicationDetails> {
    return this.withSessionOf(await this.requireOwn(userId, id));
  }

  /** Takes the user out of the pool (FR-031); withdrawing again changes nothing. */
  async withdraw(userId: string, id: string): Promise<ApplicationDetails> {
    const application = await this.requireOwn(userId, id);
    const withdrawn =
      application.status === 'withdrawn'
        ? application
        : WITHDRAWABLE.includes(application.status) && (await this.applicationsRepository.withdraw(id, WITHDRAWABLE));
    if (!withdrawn) {
      throw new DomainError('CONFLICT', 'Only an application waiting in the pool can be withdrawn');
    }
    return this.withSessionOf(withdrawn);
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
    const sessions = await this.eventSessionsService.getByIds([application.sessionId]);
    return withSession(application, required(sessions.get(application.sessionId)));
  }
}

function withSession(application: Application, session: EventSession): ApplicationDetails {
  const round = application.status === 'in_pool' ? nextRoundAt(session.startsAt) : undefined;
  return {
    ...application,
    eventId: session.eventId,
    sessionStartsAt: session.startsAt,
    cutoffAt: session.cutoffAt,
    nextRoundAt: round?.toISOString() ?? null,
  };
}

/** An application always has a session; a missing one is a data bug, so a 500. */
function required(session: EventSession | undefined): EventSession {
  if (!session) {
    throw new Error('Application refers to a missing event session');
  }
  return session;
}
