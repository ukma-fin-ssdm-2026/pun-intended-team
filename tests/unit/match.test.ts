// Written with the help of Claude
// Unit tests for match, the round pairing (docs/architecture/mechanisms/matching.md, rule 8).
// Written before the function exists, as its specification (#285).
// Run with `npx nest build && node --test tests/unit/match.test.ts`.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fc from 'fast-check';
import { interestOverlap } from '../../dist/core/matching/services/interest-overlap.js';
import { match } from '../../dist/core/matching/services/match.js';
import type { Exclusion, Pairing, PoolMember } from '../../dist/core/matching/types/matching.js';

const SEED = 42;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CONSECUTIVE_RUNS = 10; // FUNC-001
const USER_IDS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];
const INTERESTS = ['hiking', 'jazz', 'chess', 'cinema', 'yoga'];

function aMember(overrides: Partial<PoolMember> = {}): PoolMember {
  return { userId: 'u1', interests: ['hiking', 'jazz'], ...overrides };
}

/** Pairs as `a+b` with the two ids sorted, since the order inside a pair carries no meaning. */
function pairKeys(pairings: Pairing[]): string[] {
  return pairings.map(({ a, b }) => [a, b].sort().join('+')).sort();
}

function pairedUsers(pairings: Pairing[]): string[] {
  return pairings.flatMap(({ a, b }) => [a, b]);
}

function isExcluded(exclusions: Exclusion[], x: string, y: string): boolean {
  return exclusions.some(([e1, e2]) => (e1 === x && e2 === y) || (e1 === y && e2 === x));
}

// US-009 AC1: A and B score 0.75, A and C score 0.2, B and C score 1/6.
const A = aMember({ userId: 'A', interests: ['hiking', 'jazz', 'chess'] });
const B = aMember({ userId: 'B', interests: ['hiking', 'jazz', 'chess', 'cinema'] });
const C = aMember({ userId: 'C', interests: ['hiking', 'yoga', 'theatre'] });

/** Six users with the same interests, so every pair scores 1. */
const TIED_POOL = USER_IDS.slice(0, 6).map((userId) => aMember({ userId }));

const poolArbitrary = fc.uniqueArray(
  fc.record({ userId: fc.constantFrom(...USER_IDS), interests: fc.subarray(INTERESTS) }),
  { selector: (member) => member.userId, maxLength: USER_IDS.length },
);
const exclusionsArbitrary = fc.array(
  fc.tuple(fc.constantFrom(...USER_IDS), fc.constantFrom(...USER_IDS)).filter(([x, y]) => x !== y),
  { maxLength: 10 },
);

describe('match', () => {
  // FR-017, US-009 AC1, the TC-13 scenario at unit level.
  test('pairs the two best-scoring users and leaves the third unmatched', () => {
    const pairings = match([A, B, C], [], SEED);

    assert.deepEqual(pairKeys(pairings), ['A+B']);
    assert.equal(pairings[0].score, interestOverlap(A.interests, B.interests));
  });

  // FR-017: greedy from the highest score down, not the highest total.
  test('pairs a user with a lower-scoring candidate only when the better one is taken', () => {
    // P+Q 0.6 is the best pair. R's best candidate is P (0.4) and S's is Q (0.4), both taken,
    // so R and S are paired at 0. P+R and Q+S would total 0.8 against 0.6, but greedy does not look for it.
    const p = aMember({ userId: 'P', interests: ['hiking', 'jazz', 'chess', 'cinema'] });
    const q = aMember({ userId: 'Q', interests: ['hiking', 'jazz', 'chess', 'yoga'] });
    const r = aMember({ userId: 'R', interests: ['hiking', 'cinema', 'theatre'] });
    const s = aMember({ userId: 'S', interests: ['jazz', 'yoga', 'football'] });

    const pairings = match([p, q, r, s], [], SEED);

    assert.deepEqual(pairKeys(pairings), ['P+Q', 'R+S']);
  });

  // FR-017, tie rule of #285: the seed orders only pairs with equal scores.
  test('gives the same pairs for every seed when the scores differ', () => {
    const results = SEEDS.map((seed) => pairKeys(match([A, B, C], [], seed)));

    for (const result of results) assert.deepEqual(result, ['A+B']);
  });

  // FR-020
  for (const { order, exclusion } of [
    { order: 'in the order given', exclusion: ['X', 'Y'] as const },
    { order: 'in the reverse order', exclusion: ['Y', 'X'] as const },
  ]) {
    test(`never pairs an excluded pair ${order}, even when it scores highest`, () => {
      // X and Y score 1 together and 0.5 with V and W; V and W score 0.2.
      const x = aMember({ userId: 'X', interests: ['hiking', 'jazz', 'chess'] });
      const y = aMember({ userId: 'Y', interests: ['hiking', 'jazz', 'chess'] });
      const v = aMember({ userId: 'V', interests: ['hiking', 'jazz', 'cinema'] });
      const w = aMember({ userId: 'W', interests: ['hiking', 'chess', 'yoga'] });

      const pairings = match([x, y, v, w], [exclusion], SEED);

      assert.ok(!pairKeys(pairings).includes('X+Y'));
      assert.deepEqual(pairedUsers(pairings).sort(), ['V', 'W', 'X', 'Y']);
    });
  }

  // Property-based: fast-check makes up the pools, so these hold for any pool, not only the ones above.
  // FUNC-002, TC-14
  test('never pairs a user twice, with themselves, from outside the pool or with an excluded user', () => {
    fc.assert(
      fc.property(poolArbitrary, exclusionsArbitrary, fc.integer(), (pool, exclusions, seed) => {
        const pairings = match(pool, exclusions, seed);

        const users = pairedUsers(pairings);
        const poolIds = new Set(pool.map((member) => member.userId));
        assert.equal(new Set(users).size, users.length);
        for (const { a, b } of pairings) {
          assert.notEqual(a, b);
          assert.ok(poolIds.has(a) && poolIds.has(b));
          assert.ok(!isExcluded(exclusions, a, b));
        }
      }),
    );
  });

  test('scores each pair with the interest overlap of its two users', () => {
    fc.assert(
      fc.property(poolArbitrary, exclusionsArbitrary, fc.integer(), (pool, exclusions, seed) => {
        const interestsOf = new Map(pool.map((member) => [member.userId, member.interests]));

        const pairings = match(pool, exclusions, seed);

        for (const { a, b, score } of pairings) {
          assert.equal(score, interestOverlap(interestsOf.get(a) ?? [], interestsOf.get(b) ?? []));
        }
      }),
    );
  });

  test('leaves no two unmatched users who could be paired', () => {
    fc.assert(
      fc.property(poolArbitrary, exclusionsArbitrary, fc.integer(), (pool, exclusions, seed) => {
        const pairings = match(pool, exclusions, seed);

        const paired = new Set(pairedUsers(pairings));
        const unmatched = pool.map((member) => member.userId).filter((id) => !paired.has(id));
        for (const x of unmatched) {
          for (const y of unmatched) {
            if (x !== y) assert.ok(isExcluded(exclusions, x, y), `${x} and ${y} are both unmatched`);
          }
        }
      }),
    );
  });

  // FUNC-001
  test('gives the same result for the same pool, exclusions and seed in consecutive runs', () => {
    const exclusions: Exclusion[] = [['u1', 'u2']];

    const results = Array.from({ length: CONSECUTIVE_RUNS }, () => match(TIED_POOL, exclusions, SEED));

    for (const result of results) assert.deepEqual(result, results[0]);
  });

  // FUNC-001
  test('orders tied pairs by the seed, so seeds 1 to 10 do not all give the same result', () => {
    const results = SEEDS.map((seed) => JSON.stringify(match(TIED_POOL, [], seed)));

    assert.ok(new Set(results).size > 1);
  });

  // FR-018
  for (const { title, pool, exclusions } of [
    { title: 'an empty pool', pool: [], exclusions: [] },
    { title: 'a pool of one', pool: [A], exclusions: [] },
    {
      title: 'a pool where every pair is excluded',
      pool: [A, B, C],
      exclusions: [
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'C'],
      ] as Exclusion[],
    },
  ]) {
    test(`gives no pairings for ${title}`, () => {
      const pairings = match(pool, exclusions, SEED);

      assert.deepEqual(pairings, []);
    });
  }

  test('does not modify the pool or the exclusions', () => {
    const pool = [...TIED_POOL, A, B, C];
    const exclusions: Exclusion[] = [
      ['A', 'B'],
      ['u3', 'u1'],
    ];
    const poolBefore = structuredClone(pool);
    const exclusionsBefore = structuredClone(exclusions);

    match(pool, exclusions, SEED);

    assert.deepEqual(pool, poolBefore);
    assert.deepEqual(exclusions, exclusionsBefore);
  });
});
