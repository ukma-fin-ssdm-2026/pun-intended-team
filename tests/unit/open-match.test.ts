// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { openCandidate } from '../../dist/core/matching/services/open-match.js';
import type { PoolMember } from '../../dist/core/matching/types/matching.js';
import { ACCEPTS_ANYONE } from './fixtures/matching.ts';

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

const LATECOMER = aMember();

// matching.md, rule 3
describe('openCandidate', () => {
  test('proposes the candidate with the best score', () => {
    // Another kind of company and other plans: 0.7; the same answers: 1.
    const weaker = aMember({ userId: 'W', desiredCompany: 'friends', afterEventPlans: ['walk'] });
    const best = aMember({ userId: 'B' });

    assert.deepEqual(openCandidate(LATECOMER, [weaker, best], []), { a: 'M', b: 'B', score: 1 });
  });

  test('proposes a low score too: open mode has no threshold', () => {
    const candidate = aMember({ userId: 'C', desiredCompany: 'friends', afterEventPlans: ['walk'], interests: [] });

    assert.equal(openCandidate(LATECOMER, [candidate], [])?.b, 'C');
  });

  test('of equal scores, proposes whoever has waited longest: the first in the pool', () => {
    const longest = aMember({ userId: 'L' });
    const newer = aMember({ userId: 'N' });

    assert.equal(openCandidate(LATECOMER, [LATECOMER, longest, newer], [])?.b, 'L');
    assert.equal(openCandidate(LATECOMER, [newer, longest], [])?.b, 'N');
  });

  // FR-020
  test('skips a candidate kept apart from the latecomer, in either order', () => {
    const excluded = aMember({ userId: 'X' });
    const other = aMember({ userId: 'O', desiredCompany: 'friends' });

    assert.equal(openCandidate(LATECOMER, [excluded, other], [['X', 'M']])?.b, 'O');
    assert.equal(openCandidate(LATECOMER, [excluded, other], [['M', 'X']])?.b, 'O');
  });

  test('skips a candidate who cannot pair with the latecomer', () => {
    const dating = aMember({ userId: 'D', desiredCompany: 'dating' });
    const otherDay = aMember({ userId: 'O', sessionIds: ['day-2'] });

    assert.equal(openCandidate(LATECOMER, [dating, otherDay], []), undefined);
  });

  test('proposes nobody from an empty pool, or one with only the latecomer', () => {
    assert.equal(openCandidate(LATECOMER, [], []), undefined);
    assert.equal(openCandidate(LATECOMER, [LATECOMER], []), undefined);
  });
});
