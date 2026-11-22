// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventSessionsService } from '../../catalog/services/event-sessions.service.ts';
import type { EventSession } from '../../catalog/types/event-session.ts';
import { DomainError } from '../../common/domain-error.ts';
import type { Transaction } from '../../common/transaction.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import type { Contacts, PublicProfile } from '../../profiles/types/profile.ts';
import { MatchesRepository } from '../repositories/matches.repository.ts';
import { type MatchRecord, type MatchView, PENDING_STATUSES } from '../types/match.ts';
import { acceptedStatus, sidesOf, viewStatus } from './match-sides.ts';

/** A participant's view of their matches, and their answer to a proposal (UC-001 steps 8–11, A3). */
@Injectable()
export class MatchesService {
  constructor(
    private readonly matchesRepository: MatchesRepository,
    private readonly eventSessionsService: EventSessionsService,
    private readonly profilesService: ProfilesService,
    private readonly transactions: TransactionRunner,
  ) {}

  /** The user's pending and mutual matches, soonest shared day first. */
  async listMine(userId: string): Promise<MatchView[]> {
    const matches = await this.matchesRepository.findByUser(userId, [...PENDING_STATUSES, 'mutual']);
    const views = await this.views(userId, matches);
    return views.sort((a, b) => (a.days[0]?.startsAt ?? '').localeCompare(b.days[0]?.startsAt ?? ''));
  }

  async getOwn(userId: string, id: string): Promise<MatchView> {
    return this.view(userId, await this.requireOwn(userId, id));
  }

  /** Accepts the proposal; when the other has accepted too, the match is mutual. Accepting again changes nothing. */
  async accept(userId: string, id: string): Promise<MatchView> {
    const match = await this.answer(userId, id, async (current, tx) => {
      const { side } = sidesOf(current, userId)!;
      const status = viewStatus(current.status, current.validUntil, side, new Date());
      if (status === 'accepted' || status === 'mutual') {
        return current;
      }
      if (status !== 'proposed') {
        throw new DomainError('CONFLICT', 'The proposal is no longer open');
      }
      const next = acceptedStatus(current.status, side);
      await this.matchesRepository.setStatus(current.id, current.status, next, tx);
      return { ...current, status: next };
    });
    return this.view(userId, match);
  }

  /**
   * Declines the proposal: both return to the pool, kept apart at this event (matching.md, rule 5). Declining again
   * changes nothing; a mutual match can no longer be declined.
   */
  async decline(userId: string, id: string): Promise<MatchView> {
    const match = await this.answer(userId, id, async (current, tx) => {
      const { side } = sidesOf(current, userId)!;
      const status = viewStatus(current.status, current.validUntil, side, new Date());
      if (status === 'declined') {
        return current;
      }
      if (status !== 'proposed' && status !== 'accepted') {
        throw new DomainError('CONFLICT', 'The proposal is no longer open');
      }
      await this.matchesRepository.decline(current, userId, tx);
      return { ...current, status: 'declined' as const };
    });
    return this.view(userId, match);
  }

  /**
   * The other participant's contacts, only once the match is mutual; before that the match is reported missing
   * (SEC-001). A mutual match still holds them back until the caller has acknowledged the safety notice (SAFE-002).
   */
  async getContacts(userId: string, id: string): Promise<Contacts> {
    const match = await this.requireOwn(userId, id);
    if (match.status !== 'mutual') {
      throw new DomainError('NOT_FOUND', 'Match not found');
    }
    if (!(await this.profilesService.hasAcknowledgedSafetyNotice(userId))) {
      throw new DomainError('SAFETY_NOTICE_REQUIRED', 'Acknowledge the safety notice first');
    }
    return this.profilesService.getContacts(sidesOf(match, userId)!.other.userId);
  }

  /** Runs `work` on the current state of the match, under the event lock, so no answer crosses a round (rule 7). */
  private async answer(
    userId: string,
    id: string,
    work: (match: MatchRecord, tx: Transaction) => Promise<MatchRecord>,
  ): Promise<MatchRecord> {
    const { eventId } = await this.requireOwn(userId, id);
    return this.transactions.run(async (tx) => {
      await this.matchesRepository.lockEvent(eventId, tx);
      return work(await this.requireOwn(userId, id, tx), tx);
    });
  }

  /** A match the user takes no part in is reported missing. */
  private async requireOwn(userId: string, id: string, tx?: Transaction): Promise<MatchRecord> {
    const match = await this.matchesRepository.findById(id, tx);
    if (!match || !sidesOf(match, userId)) {
      throw new DomainError('NOT_FOUND', 'Match not found');
    }
    return match;
  }

  private async view(userId: string, match: MatchRecord): Promise<MatchView> {
    const [view] = await this.views(userId, [match]);
    return view!;
  }

  private async views(userId: string, matches: MatchRecord[]): Promise<MatchView[]> {
    const sides = matches.map((match) => ({ match, ...sidesOf(match, userId)! }));
    const [profiles, sessions] = await Promise.all([
      this.profilesService.getPublicProfiles(sides.map(({ other }) => other.userId)),
      this.eventSessionsService.getByIds(sides.flatMap(({ own }) => own.sessionIds)),
    ]);
    const now = new Date();
    return sides.map(({ match, side, own, other }) => {
      const otherDays = new Set(other.sessionIds);
      const { accountId: _accountId, ...profile } = required(profiles.get(other.userId));
      return {
        id: match.id,
        eventId: match.eventId,
        applicationId: own.id,
        status: viewStatus(match.status, match.validUntil, side, now),
        days: own.sessionIds
          .filter((sessionId) => otherDays.has(sessionId))
          .map((sessionId) => required(sessions.get(sessionId)))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .map(({ startsAt, cutoffAt }) => ({ startsAt, cutoffAt })),
        validUntil: match.validUntil,
        partner: { ...profile, desiredCompany: other.desiredCompany, afterEventPlans: other.afterEventPlans },
        createdAt: match.createdAt,
      };
    });
  }
}

/** A participant always has a profile and the sessions of their application; a missing one is a data bug, so a 500. */
function required<T extends PublicProfile | EventSession>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('A match refers to a missing profile or session');
  }
  return value;
}
