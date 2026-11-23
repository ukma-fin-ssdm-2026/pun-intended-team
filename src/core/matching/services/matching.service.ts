// Written with the help of Claude
import { randomInt } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventSessionsService } from '../../catalog/services/event-sessions.service.ts';
import type { EventSession, OpenedSession } from '../../catalog/types/event-session.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import type { Transaction } from '../../common/transaction.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { JobQueue } from '../../jobs/adapters/job-queue.ts';
import { ModerationService } from '../../moderation/services/moderation.service.ts';
import { NotificationsService } from '../../notifications/services/notifications.service.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { ApplicationsRepository } from '../repositories/applications.repository.ts';
import { MatchesRepository } from '../repositories/matches.repository.ts';
import type { Application, ApplicationStatus } from '../types/application.ts';
import { type Match, type MatchSource, PENDING_STATUSES } from '../types/match.ts';
import type { Exclusion, Pairing, PoolMember } from '../types/matching.ts';
import { instantCandidate } from './instant-match.ts';
import { match } from './match.ts';
import { openCandidate } from './open-match.ts';
import { nextRoundAt, proposalValidUntil, roundTimes } from './rounds.ts';

const ROUND_JOB = 'matching.round';
const CUTOFF_JOB = 'matching.cutoff';
const EXPIRE_JOB = 'matching.expire';

/** The pool of an event as one matching step reads it under the lock. */
interface Pool {
  /**
   * By user, oldest application first: an application waiting on at least one open day, whose user has a profile and
   * is not banned.
   */
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
    private readonly notificationsService: NotificationsService,
    private readonly transactions: TransactionRunner,
    private readonly jobs: JobQueue,
  ) {}

  onModuleInit(): void {
    this.jobs.register<{ sessionId: string }>(ROUND_JOB, ({ payload }) => this.runRound(payload.sessionId));
    this.jobs.register<{ sessionId: string }>(CUTOFF_JOB, ({ payload }) => this.closeSession(payload.sessionId));
  }

  /** Every match proposed so far, whatever its state. */
  async stats(): Promise<{ matches: number }> {
    return { matches: await this.matchesRepository.count() };
  }

  /**
   * Plans the rounds and the cutoff of the sessions an application has just created, in its transaction (matching.md,
   * rules 2 and 3).
   */
  async scheduleRounds(sessions: OpenedSession[], tx: Transaction): Promise<void> {
    const now = new Date();
    for (const session of sessions.filter(({ created }) => created)) {
      for (const runAt of roundTimes(session.startsAt, now)) {
        await this.jobs.enqueue(ROUND_JOB, { sessionId: session.id }, { runAt }, tx);
      }
      await this.jobs.enqueue(CUTOFF_JOB, { sessionId: session.id }, { runAt: new Date(session.cutoffAt) }, tx);
    }
  }

  /**
   * Proposes a match for a new application at once: in open mode the best partner waiting on a day past its last
   * round (rule 3), otherwise only an exceptionally good partner (rule 1).
   */
  async matchOnApply(application: Application): Promise<boolean> {
    const seed = randomSeed();
    const proposed = await this.transactions.run(async (tx) => {
      await this.matchesRepository.lockEvent(application.eventId, tx);
      const pool = await this.readPool(application.eventId, application.sessionIds, tx);
      const member = pool.members.get(application.userId);
      if (!member) {
        return [];
      }
      const open = await this.matchOpen(member, pool, seed, tx);
      if (open) {
        return [open];
      }
      const candidate = instantCandidate(member, [...pool.members.values()], pool.exclusions, seed);
      if (!candidate) {
        return [];
      }
      // Below the threshold too, so the threshold can be tuned on real data (matching.md, policy).
      this.#logger.log(
        `Instant match for application ${application.id}: best score ${candidate.pairing.score}` +
          (candidate.proposed ? '' : ', not proposed'),
      );
      return candidate.proposed ? [await this.propose(candidate.pairing, pool, 'instant', seed, tx)] : [];
    });
    this.logProposals(proposed);
    return proposed.length > 0;
  }

  /**
   * After a decline or a withdrawal returned the applications to the pool: each is matched in open mode if one of its
   * days is past its last round (rule 3), or ends with no match if none of its days is open any more (FR-018). Each
   * takes the event lock on its own. A failure is logged and leaves the application in the pool, as for an apply.
   */
  async matchReturned(applicationIds: string[]): Promise<void> {
    for (const id of applicationIds) {
      try {
        const eventId = (await this.applicationsRepository.findById(id))?.eventId;
        if (!eventId) {
          continue;
        }
        const proposed = await this.transactions.run(async (tx) => {
          await this.matchesRepository.lockEvent(eventId, tx);
          const application = await this.applicationsRepository.findById(id, tx);
          if (application?.status !== 'in_pool') {
            return [];
          }
          const pool = await this.readPool(application.eventId, application.sessionIds, tx);
          if (!application.sessionIds.some((sessionId) => isOpenAt(pool.sessions.get(sessionId), new Date()))) {
            await this.endWithNoMatch([application], tx);
            return [];
          }
          const member = pool.members.get(application.userId);
          const open = member && (await this.matchOpen(member, pool, randomSeed(), tx));
          return open ? [open] : [];
        });
        this.logProposals(proposed);
      } catch (error) {
        this.#logger.error(`Matching application ${id} on its return to the pool failed`, error);
      }
    }
  }

  /**
   * Withdraws the application if its status is still one of `from`, under the event lock, so a round that has read
   * the pool never proposes it meanwhile (rule 7). A pending proposal is cancelled and the other user returns to the
   * pool (A5) and is matched again in open mode; a mutual match is kept, so the application stays. Undefined if the
   * status changed.
   */
  async withdraw(application: Application, from: ApplicationStatus[]): Promise<Application | undefined> {
    const { withdrawn, returned } = await this.transactions.run(async (tx) => {
      await this.matchesRepository.lockEvent(application.eventId, tx);
      const match = await this.matchesRepository.findByApplication(application.id, [...PENDING_STATUSES, 'mutual'], tx);
      if (match?.status === 'mutual') {
        throw new DomainError('CONFLICT', 'An application with a mutual match cannot be withdrawn');
      }
      if (match) {
        await this.matchesRepository.cancelForWithdrawal(match, application.id, tx);
      }
      const withdrawn = await this.applicationsRepository.withdraw(application.id, from, tx);
      const other = match && (match.applicationAId === application.id ? match.applicationBId : match.applicationAId);
      return { withdrawn, returned: withdrawn && other };
    });
    if (returned) {
      await this.matchReturned([returned]);
    }
    return withdrawn;
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

  /**
   * The `matching.cutoff` job: the applications still in the pool of the session that have no other open day end
   * with no match, and their users are told (FR-018). A pending proposal is left to expire (rule 6). A cancelled
   * session is left alone; a session whose cutoff has moved later since the job was planned gets a job at the new
   * cutoff. A repeated job finds nobody left in the pool.
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = (await this.eventSessionsService.getByIds([sessionId])).get(sessionId);
    if (session?.status !== 'scheduled') {
      return;
    }
    if (isOpen(session, new Date())) {
      await this.jobs.enqueue(CUTOFF_JOB, { sessionId }, { runAt: new Date(session.cutoffAt) });
      return;
    }
    await this.transactions.run(async (tx) => {
      await this.matchesRepository.lockEvent(session.eventId, tx);
      const waiting = await this.applicationsRepository.findPool([sessionId], tx);
      const days = await this.eventSessionsService.getByIds(
        waiting.flatMap(({ sessionIds }) => sessionIds),
        tx,
      );
      const now = new Date();
      await this.endWithNoMatch(
        waiting.filter(({ sessionIds }) => !sessionIds.some((id) => isOpenAt(days.get(id), now))),
        tx,
      );
    });
  }

  /**
   * Proposes the open-mode partner of `member` (rule 3) when any of their days is past its last round and before its
   * cutoff. Only users waiting on one of those days are considered; undefined when nobody fits.
   */
  private async matchOpen(member: PoolMember, pool: Pool, seed: number, tx: Transaction): Promise<Match | undefined> {
    const now = new Date();
    const openDays = new Set(member.sessionIds.filter((id) => inOpenMode(required(pool.sessions.get(id)), now)));
    if (openDays.size === 0) {
      return undefined;
    }
    const waiting = [...pool.members.values()].filter(({ sessionIds }) => sessionIds.some((id) => openDays.has(id)));
    const pairing = openCandidate(member, waiting, pool.exclusions);
    return pairing && this.propose(pairing, pool, 'open', seed, tx);
  }

  /** Moves the applications to `no_match` and tells their users, in `tx` (FR-018; notifications.md, rule 1). */
  private async endWithNoMatch(applications: Application[], tx: Transaction): Promise<void> {
    if (applications.length === 0) {
      return;
    }
    await this.applicationsRepository.markNoMatch(
      applications.map(({ id }) => id),
      tx,
    );
    for (const { id, userId, eventId } of applications) {
      await this.notificationsService.notify(
        userId,
        'no_match_found',
        { applicationId: id, eventId },
        `no_match_found:${id}`,
        tx,
      );
    }
    this.#logger.log(`No match found for applications ${applications.map(({ id }) => id).join(', ')}`);
  }

  /**
   * The pool of `sessionIds` with what each member needs for matching. Ages are taken on the first of those days in
   * Kyiv: the round's day, or the first day of an application that asks for an instant match.
   */
  private async readPool(eventId: string, sessionIds: string[], tx: Transaction): Promise<Pool> {
    const applications = await this.applicationsRepository.findPool(sessionIds, tx);
    const declined = await this.matchesRepository.findExcludedPairs(eventId, tx);
    const userIds = applications.map(({ userId }) => userId);
    const sessions = await this.eventSessionsService.getByIds(
      [...sessionIds, ...applications.flatMap((application) => application.sessionIds)],
      tx,
    );
    const [traits, moderation] = await Promise.all([
      this.profilesService.getMatchingTraits(userIds, matchingDay(sessionIds, sessions), tx),
      this.moderationService.exclusionsFor(userIds, tx),
    ]);
    const now = new Date();
    const banned = new Set(moderation.banned);
    const members = new Map<string, PoolMember>();
    for (const application of applications) {
      const memberTraits = traits.get(application.userId);
      const openDays = application.sessionIds.filter((id) => isOpenAt(sessions.get(id), now));
      if (memberTraits && openDays.length > 0 && !banned.has(application.userId)) {
        members.set(application.userId, {
          userId: application.userId,
          interests: memberTraits.interests,
          desiredCompany: application.desiredCompany,
          afterEventPlans: application.afterEventPlans,
          sessionIds: openDays,
          gender: memberTraits.gender,
          age: memberTraits.age,
          preferredGender: application.preferredGender,
          ageMin: application.ageMin,
          ageMax: application.ageMax,
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

/** The Kyiv day of the earliest of the sessions; today when none of them is known. */
function matchingDay(sessionIds: string[], sessions: Map<string, EventSession>): string {
  const starts = sessionIds.flatMap((id) => sessions.get(id)?.startsAt ?? []).sort((a, b) => a.localeCompare(b));
  return kyivDate(starts[0]);
}

function isOpen(session: EventSession, now: Date): boolean {
  return session.status === 'scheduled' && new Date(session.cutoffAt) > now;
}

function isOpenAt(session: EventSession | undefined, now: Date): boolean {
  return session !== undefined && isOpen(session, now);
}

/** Past the session's last round and before its cutoff (matching.md, rule 3). */
function inOpenMode(session: EventSession, now: Date): boolean {
  return isOpen(session, now) && nextRoundAt(session.startsAt, now) === undefined;
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
