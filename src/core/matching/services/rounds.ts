// Written with the help of Claude
import type { EventSession } from '../../catalog/types/event-session.ts';
import { DAY_MS, HOUR_MS } from '../../common/durations.ts';

/** How long before a session starts each round pairs its pool (matching.md, policy). */
const ROUND_OFFSETS_MS = [7 * DAY_MS, 3 * DAY_MS, DAY_MS, 6 * HOUR_MS];

/** The longest a proposal waits for both answers (matching.md, rule 4). */
const PROPOSAL_LIFETIME_MS = DAY_MS;

/** The rounds of a session still to come after `now`, soonest first; past offsets are skipped (rule 2). */
export function roundTimes(sessionStartsAt: Date | string, now: Date = new Date()): Date[] {
  const start = new Date(sessionStartsAt).getTime();
  return ROUND_OFFSETS_MS.map((offset) => new Date(start - offset)).filter((round) => round > now);
}

/** The first round after `now`; undefined once the last round has run. */
export function nextRoundAt(sessionStartsAt: Date | string, now: Date = new Date()): Date | undefined {
  return roundTimes(sessionStartsAt, now)[0];
}

/**
 * When a proposal made at `createdAt` ends unanswered: 24 hours later, or when the next round on any of the shared
 * days starts, or at the last shared day's cutoff, whichever comes first (matching.md, rule 4).
 */
export function proposalValidUntil(createdAt: Date, sharedDays: Pick<EventSession, 'startsAt' | 'cutoffAt'>[]): Date {
  const cutoffs = sharedDays.map(({ cutoffAt }) => new Date(cutoffAt).getTime());
  const limits = [
    createdAt.getTime() + PROPOSAL_LIFETIME_MS,
    ...sharedDays.flatMap(({ startsAt }) => nextRoundAt(startsAt, createdAt)?.getTime() ?? []),
    ...(cutoffs.length > 0 ? [Math.max(...cutoffs)] : []),
  ];
  return new Date(Math.min(...limits));
}
