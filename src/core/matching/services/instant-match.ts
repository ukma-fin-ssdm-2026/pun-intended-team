// Written with the help of Claude
import type { Exclusion, Pairing, PoolMember } from '../types/matching.ts';
import { fitsWith } from './fits.ts';
import { pairScore } from './pair-score.ts';
import { shuffled } from './seeded-shuffle.ts';

/** The pair score an instant match needs (matching.md, policy). */
export const INSTANT_MATCH_THRESHOLD = 0.8;

/** The best candidate of a user who applies, and whether the two are matched at once. */
export interface InstantCandidate {
  pairing: Pairing;
  /** The score reaches the threshold, and no one in the pool suits the candidate better (matching.md, rule 1). */
  proposed: boolean;
}

/**
 * The best candidate of `member` in the pool as they apply, if anyone can be paired with them. The seed orders
 * candidates with equal scores; an equal score with someone else still counts as the best option.
 */
export function instantCandidate(
  member: PoolMember,
  pool: PoolMember[],
  exclusions: Exclusion[],
  seed: number,
): InstantCandidate | undefined {
  const fits = fitsWith(exclusions);
  const [best] = shuffled(
    pool.filter((candidate) => fits(member, candidate)),
    seed,
  )
    .map((candidate) => ({ candidate, score: pairScore(member, candidate) }))
    .sort((p, q) => q.score - p.score);
  if (!best) {
    return undefined;
  }
  const suitsBetter = pool.some(
    (other) =>
      other.userId !== member.userId && fits(best.candidate, other) && pairScore(best.candidate, other) > best.score,
  );
  return {
    pairing: { a: member.userId, b: best.candidate.userId, score: best.score },
    proposed: best.score >= INSTANT_MATCH_THRESHOLD && !suitsBetter,
  };
}
