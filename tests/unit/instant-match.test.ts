// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { INSTANT_MATCH_THRESHOLD, instantCandidate } from '../../dist/core/matching/services/instant-match.js';
import type { Exclusion, PoolMember } from '../../dist/core/matching/types/matching.js';
import { ACCEPTS_ANYONE } from './fixtures/matching.ts';

const SEED = 42;
const JAZZ = { id: 'jazz', group: 'music' };

function aMember(overrides: Partial<PoolMember> = {}): PoolMember {
  return {
    userId: 'M',
    interests: [JAZZ],
    desiredCompany: 'company',
    afterEventPlans: [],
    sessionIds: ['day-1'],
    ...ACCEPTS_ANYONE,
    ...overrides,
  };
}

const NEWCOMER = aMember();

// matching.md, rule 1
describe('instantCandidate', () => {
  test('pairs the newcomer with a candidate who scores 1 and has no better option', () => {
    const candidate = aMember({ userId: 'C' });

    const best = instantCandidate(NEWCOMER, [NEWCOMER, candidate], [], SEED);

    assert.deepEqual(best, { pairing: { a: 'M', b: 'C', score: 1 }, proposed: true });
  });

  test('pairs at exactly the threshold', () => {
    // The same interests and plans, another kind of company: 0.7 + 0.1.
    const candidate = aMember({ userId: 'C', desiredCompany: 'friends' });

    const best = instantCandidate(NEWCOMER, [candidate], [], SEED);

    assert.equal(best?.pairing.score, INSTANT_MATCH_THRESHOLD);
    assert.equal(best?.proposed, true);
  });

  test('waits for a round when the best candidate scores below the threshold', () => {
    // Another kind of company and other plans: 0.7.
    const candidate = aMember({ userId: 'C', desiredCompany: 'friends', afterEventPlans: ['walk'] });

    const best = instantCandidate(NEWCOMER, [candidate], [], SEED);

    assert.deepEqual(best, { pairing: { a: 'M', b: 'C', score: 0.7 }, proposed: false });
  });

  test('waits for a round when someone else in the pool suits the candidate better', () => {
    // The newcomer and the candidate score 0.8; the candidate and the other score 1.
    const newcomer = aMember({ desiredCompany: 'friends' });
    const candidate = aMember({ userId: 'C' });
    const other = aMember({ userId: 'O' });

    const best = instantCandidate(newcomer, [candidate, other], [], SEED);

    assert.equal(best?.pairing.score, 0.8);
    assert.equal(best?.proposed, false);
  });

  test('pairs when someone else suits the candidate equally well', () => {
    const candidate = aMember({ userId: 'C' });
    const other = aMember({ userId: 'O' });

    const best = instantCandidate(NEWCOMER, [candidate, other], [], SEED);

    assert.equal(best?.pairing.score, 1);
    assert.equal(best?.proposed, true);
  });

  // FR-020
  for (const exclusion of [['M', 'C'] as const, ['C', 'M'] as const] satisfies Exclusion[]) {
    test(`skips an excluded candidate given as [${exclusion.join(', ')}]`, () => {
      assert.equal(instantCandidate(NEWCOMER, [aMember({ userId: 'C' })], [exclusion], SEED), undefined);
    });
  }

  test('skips a candidate the newcomer cannot be paired with', () => {
    const best = instantCandidate(NEWCOMER, [aMember({ userId: 'C', sessionIds: ['day-2'] })], [], SEED);

    assert.equal(best, undefined);
  });

  test('gives no partner in a pool of the newcomer alone', () => {
    assert.equal(instantCandidate(NEWCOMER, [NEWCOMER], [], SEED), undefined);
  });

  // FUNC-001
  test('picks among equal candidates by the seed, the same every time', () => {
    const pool = ['A', 'B', 'C', 'D'].map((userId) => aMember({ userId }));

    const runs = Array.from({ length: 10 }, () => instantCandidate(NEWCOMER, pool, [], SEED)?.pairing.b);
    const bySeed = new Set(
      Array.from({ length: 10 }, (_, seed) => instantCandidate(NEWCOMER, pool, [], seed)?.pairing.b),
    );

    assert.equal(new Set(runs).size, 1);
    assert.ok(bySeed.size > 1);
  });

  // matching.md, policy: whom each wants to go with
  test('skips a high-scoring candidate who does not want the newcomer’s gender', () => {
    const newcomer = aMember({ gender: 'male' });
    const womenOnly = aMember({ userId: 'W', preferredGender: 'female' });

    const best = instantCandidate(newcomer, [newcomer, womenOnly], [], SEED);

    assert.equal(best, undefined);
  });

  test('skips a candidate outside the newcomer’s age range', () => {
    const newcomer = aMember({ ageMin: 30, ageMax: 35 });
    const younger = aMember({ userId: 'Y', age: 29 });

    const best = instantCandidate(newcomer, [newcomer, younger], [], SEED);

    assert.equal(best, undefined);
  });
});
