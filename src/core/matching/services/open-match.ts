// Written with the help of Claude
import type { Exclusion, Pairing, PoolMember } from '../types/matching.ts';
import { fitsWith } from './fits.ts';
import { pairScore } from './pair-score.ts';

/**
 * The partner open mode proposes to `member` (matching.md, rule 3): whoever in the pool fits them with the best
 * score, with no threshold. `pool` lists users by their application, oldest first, so of equal scores the user who
 * has waited longest wins.
 */
export function openCandidate(member: PoolMember, pool: PoolMember[], exclusions: Exclusion[]): Pairing | undefined {
  const fits = fitsWith(exclusions);
  let best: Pairing | undefined;
  for (const candidate of pool) {
    if (!fits(member, candidate)) continue;
    const score = pairScore(member, candidate);
    if (!best || score > best.score) {
      best = { a: member.userId, b: candidate.userId, score };
    }
  }
  return best;
}
