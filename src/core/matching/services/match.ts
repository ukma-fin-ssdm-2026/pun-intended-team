// Written with the help of Claude
import type { Exclusion, Pairing, PoolMember } from '../types/matching.ts';
import { fitsWith } from './fits.ts';
import { pairScore } from './pair-score.ts';
import { shuffled } from './seeded-shuffle.ts';

/** Pairs one round's pool greedily, from the highest score down (matching.md, rule 8). */
export function match(pool: PoolMember[], exclusions: Exclusion[], seed: number): Pairing[] {
  const fits = fitsWith(exclusions);
  const candidates: Pairing[] = [];
  pool.forEach((a, i) => {
    for (const b of pool.slice(i + 1)) {
      if (!fits(a, b)) continue;
      candidates.push({ a: a.userId, b: b.userId, score: pairScore(a, b) });
    }
  });

  // The shuffle orders only pairs with equal scores: the sort that follows is stable.
  const ordered = shuffled(candidates, seed).sort((p, q) => q.score - p.score);

  const taken = new Set<string>();
  const pairings: Pairing[] = [];
  for (const pairing of ordered) {
    if (taken.has(pairing.a) || taken.has(pairing.b)) continue;
    taken.add(pairing.a);
    taken.add(pairing.b);
    pairings.push(pairing);
  }
  return pairings;
}
