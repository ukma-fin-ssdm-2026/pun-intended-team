// Written with the help of Claude
import type { Exclusion, Pairing, PoolMember } from '../types/matching.ts';
import { interestOverlap } from './interest-overlap.ts';

/** Pairs one round's pool greedily, from the highest interest overlap down (matching.md, rule 8). */
export function match(pool: PoolMember[], exclusions: Exclusion[], seed: number): Pairing[] {
  const excluded = new Set(exclusions.flatMap(([x, y]) => [pairKey(x, y), pairKey(y, x)]));
  const candidates: Pairing[] = [];
  pool.forEach((a, i) => {
    for (const b of pool.slice(i + 1)) {
      if (a.userId === b.userId || excluded.has(pairKey(a.userId, b.userId))) continue;
      candidates.push({ a: a.userId, b: b.userId, score: interestOverlap(a.interests, b.interests) });
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

function pairKey(x: string, y: string): string {
  return `${x}\u0000${y}`;
}

/** A shuffle seeded with mulberry32, so the same seed always gives the same order. */
function shuffled<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return items
    .map((item) => ({ item, key: random() }))
    .sort((x, y) => x.key - y.key)
    .map(({ item }) => item);
}
