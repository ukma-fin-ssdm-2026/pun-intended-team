// Written with the help of Claude
import type { Exclusion, Pairing, PoolMember } from '../types/matching.ts';
import { fitsWith } from './fits.ts';
import { pairScore } from './pair-score.ts';
import { shuffled } from './seeded-shuffle.ts';

/** The pair score an instant match needs (matching.md, policy). */
export const INSTANT_MATCH_THRESHOLD = 0.8;

/**
 * Who `member` is matched with as they apply, if anyone: their best candidate in the pool scores at least the
 * threshold, and no one in the pool suits that candidate better (matching.md, rule 1). The seed orders candidates
 * with equal scores; an equal score with someone else still counts as the best option.
 */
export function instantPartner(
  member: PoolMember,
  pool: PoolMember[],
  exclusions: Exclusion[],
  seed: number,
): Pairing | undefined {
  const fits = fitsWith(exclusions);
  const [best] = shuffled(
    pool.filter((candidate) => fits(member, candidate)),
    seed,
  )
    .map((candidate) => ({ candidate, score: pairScore(member, candidate) }))
    .sort((p, q) => q.score - p.score);
  if (!best || best.score < INSTANT_MATCH_THRESHOLD) {
    return undefined;
  }
  const suitsBetter = pool.some(
    (other) =>
      other.userId !== member.userId && fits(best.candidate, other) && pairScore(best.candidate, other) > best.score,
  );
  return suitsBetter ? undefined : { a: member.userId, b: best.candidate.userId, score: best.score };
}
