// Written with the help of Claude
import type { Exclusion, PoolMember } from '../types/matching.ts';
import { canPair } from './pair-score.ts';

/** Whether two pool members may be proposed to each other: two different users, not excluded (FR-020), who can pair. */
export function fitsWith(exclusions: Exclusion[]): (a: PoolMember, b: PoolMember) => boolean {
  const excluded = new Set(exclusions.flatMap(([x, y]) => [pairKey(x, y), pairKey(y, x)]));
  return (a, b) => a.userId !== b.userId && !excluded.has(pairKey(a.userId, b.userId)) && canPair(a, b);
}

function pairKey(x: string, y: string): string {
  return `${x}\u0000${y}`;
}
