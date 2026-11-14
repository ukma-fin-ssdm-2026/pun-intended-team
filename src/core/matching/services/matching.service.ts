// Written with the help of Claude
import { randomInt } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventSessionsService } from '../../catalog/services/event-sessions.service.ts';
import type { EventSession, OpenedSession } from '../../catalog/types/event-session.ts';
import type { Transaction } from '../../common/transaction.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { JobQueue } from '../../jobs/adapters/job-queue.ts';
import { ModerationService } from '../../moderation/services/moderation.service.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { ApplicationsRepository } from '../repositories/applications.repository.ts';
import { MatchesRepository } from '../repositories/matches.repository.ts';
import type { Application, ApplicationStatus } from '../types/application.ts';
import type { Match, MatchSource } from '../types/match.ts';
import type { Exclusion, Pairing, PoolMember } from '../types/matching.ts';
import { instantPartner } from './instant-match.ts';
import { match } from './match.ts';
import { proposalValidUntil, roundTimes } from './rounds.ts';

const ROUND_JOB = 'matching.round';
const EXPIRE_JOB = 'matching.expire';

/** The pool of an event as one matching step reads it under the lock. */
interface Pool {
  /** By user: an application waiting on at least one open day, whose user has a profile and is not banned. */
  members: Map<string, PoolMember>;
  applications: Map<string, Application>;
  sessions: Map<string, EventSession>;
  exclusions: Exclusion[];
}

@Injectable()
export class MatchingService implements OnModuleInit {
  readonly #logger = new Logger(MatchingService.name);

  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly eventSessionsService: EventSessionsService,
    private readonly profilesService: ProfilesService,
    private readonly moderationService: ModerationService,
    private readonly transactions: TransactionRunner,
    private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register<{ sessionId: string }>(ROUND_JOB, ({ payload }) => this.runRound(payload.sessionId));
  }

  /** Every match proposed so far, whatever its state. */
  async stats(): Promise<{ matches: number }> {
    return { matches: await this.matchesRepository.count() };
  }

  /** Plans the rounds of the sessions an application has just created, in its transaction (matching.md, rule 2). */
  async scheduleRounds(sessions: OpenedSession[], tx: Transaction): Promise<void> {
    const now = new Date();
    for (const session of sessions.filter(({ created }) => created)) {
      for (const runAt of roundTimes(session.startsAt, now)) {
        await this.jobs.enqueue(ROUND_JOB, { sessionId: session.id }, { runAt }, tx);
      }
    }
  }

  /** Proposes a match for a new application at once if it has an exceptionally good partner (rule 1). */
  async matchOnApply(application: Application): Promise<boolean> {
    const seed = randomSeed();
    const proposed = await this.transactions.run(async (tx) => {
      await this.matchesRepository.lockEvent(application.eventId, tx);
      const pool = await this.readPool(application.eventId, application.sessionIds, tx);
      const member = pool.members.get(application.userId);
      const pairing = member && instantPartner(member, [...pool.members.values()], pool.exclusions, seed);
      return pairing ? [await this.propose(pairing, pool, 'instant', seed, tx)] : [];
    });
    this.logProposals(proposed);
    return proposed.length > 0;
  }

  /**
   * Withdraws the application if its status is still one of `from`, under the event lock, so a round that has read
   * the pool never proposes it meanwhile (rule 7). Undefined if the status changed.
   */
  async withdraw(application: Application, from: ApplicationStatus[]): Promise<Application | undefined> {
    return this.transactions.run(async (tx) => {
      await this.matchesRepository.lockEvent(application.eventId, tx);
      return this.applicationsRepository.withdraw(application.id, from, tx);
    });
  }

  /**
   * The `matching.round` job: pairs the session's whole pool (rule 2). A cancelled session or one past its cutoff
   * is left alone, and a repeated job pairs only who is still waiting.
   */
  async runRound(sessionId: string): Promise<void> {
    const session = (await this.eventSessionsService.getByIds([sessionId])).get(sessionId);
    if (!session || !isOpen(session, new Date())) {
      return;
    }
    const seed = randomSeed();
    const proposed = await this.transactions.run(async (tx) => {
      await this.matchesRepository.lockEvent(session.eventId, tx);
      const pool = await this.readPool(session.eventId, [sessionId], tx);
      const proposals: Match[] = [];
      for (const pairing of match([...pool.members.values()], pool.exclusions, seed)) {
        proposals.push(await this.propose(pairing, pool, 'round', seed, tx));
      }
      return proposals;
    });
    this.logProposals(proposed);
  }

  private async readPool(eventId: string, sessionIds: string[], tx: Transaction): Promise<Pool> {
    const applications = await this.applicationsRepository.findPool(sessionIds, tx);
    const declined = await this.matchesRepository.findExcludedPairs(eventId, tx);
    const userIds = applications.map(({ userId }) => userId);
    const [interests, moderation, sessions] = await Promise.all([
      this.profilesService.getInterests(userIds, tx),
      this.moderationService.exclusionsFor(userIds, tx),
      this.eventSessionsService.getByIds(
        applications.flatMap((application) => application.sessionIds),
        tx,
      ),
    ]);
    const now = new Date();
    const banned = new Set(moderation.banned);
    const members = new Map<string, PoolMember>();
    for (const application of applications) {
      const memberInterests = interests.get(application.userId);
      const openDays = application.sessionIds.filter((id) => {
        const session = sessions.get(id);
        return session !== undefined && isOpen(session, now);
      });
      if (memberInterests && openDays.length > 0 && !banned.has(application.userId)) {
        members.set(application.userId, {
          userId: application.userId,
          interests: memberInterests,
          desiredCompany: application.desiredCompany,
          afterEventPlans: application.afterEventPlans,
          sessionIds: openDays,
        });
      }
    }
    return {
      members,
      applications: new Map(applications.map((application) => [application.userId, application])),
      sessions,
      exclusions: [...moderation.reported, ...declined],
    };
  }

  private async propose(
    { a, b, score }: Pairing,
    pool: Pool,
    source: MatchSource,
    seed: number,
    tx: Transaction,
  ): Promise<Match> {
    const daysOfB = new Set(required(pool.members.get(b)).sessionIds);
    const sharedDays = required(pool.members.get(a))
      .sessionIds.filter((id) => daysOfB.has(id))
      .map((id) => required(pool.sessions.get(id)));
    const validUntil = proposalValidUntil(new Date(), sharedDays);
    const match = await this.matchesRepository.propose(
      {
        applicationAId: required(pool.applications.get(a)).id,
        applicationBId: required(pool.applications.get(b)).id,
        source,
        score,
        seed,
        validUntil,
      },
      tx,
    );
    // Its handler comes with expiry and strikes; the job waits in the queue until then (HLD I3).
    await this.jobs.enqueue(EXPIRE_JOB, { matchId: match.id }, { runAt: validUntil }, tx);
    return match;
  }

  /** Every proposed score is logged, so the threshold can be tuned on real data (matching.md, policy). */
  private logProposals(proposals: Match[]): void {
    for (const { id, source, applicationAId, applicationBId, score, seed } of proposals) {
      this.#logger.log(
        `Proposed match ${id} (${source}): applications ${applicationAId} and ${applicationBId}, score ${score}, seed ${seed}`,
      );
    }
  }
}

function isOpen(session: EventSession, now: Date): boolean {
  return session.status === 'scheduled' && new Date(session.cutoffAt) > now;
}

/** A new seed for every matching step, so ties are broken differently each time (FUNC-001). */
function randomSeed(): number {
  return randomInt(2 ** 32);
}

/** Every member comes from the pool it is looked up in; a missing one is a bug, so a 500. */
function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('A pairing refers to a user outside the pool');
  }
  return value;
}
