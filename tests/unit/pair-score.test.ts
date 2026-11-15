// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { canPair, pairScore } from '../../dist/core/matching/services/pair-score.js';
import type { PoolMember } from '../../src/core/matching/types/matching.ts';

const JAZZ = { id: 'jazz', group: 'music' };
const INDIE = { id: 'indie', group: 'music' };
const ROCK = { id: 'rock', group: 'music' };
const HIKING = { id: 'hiking', group: 'sport' };
const YOGA = { id: 'yoga', group: 'sport' };
const CHESS = { id: 'chess', group: 'games' };

function aMember(overrides: Partial<PoolMember> = {}): PoolMember {
  return {
    userId: 'u1',
    interests: [JAZZ, HIKING],
    desiredCompany: 'company',
    afterEventPlans: [],
    sessionIds: ['day-1'],
    ...overrides,
  };
}

describe('canPair', () => {
  const cases: { title: string; a: Partial<PoolMember>; b: Partial<PoolMember>; expected: boolean }[] = [
    { title: 'pairs two users on the same day', a: {}, b: {}, expected: true },
    {
      title: 'pairs friends with company',
      a: { desiredCompany: 'friends' },
      b: { desiredCompany: 'company' },
      expected: true,
    },
    {
      title: 'pairs dating with dating',
      a: { desiredCompany: 'dating' },
      b: { desiredCompany: 'dating' },
      expected: true,
    },
    {
      title: 'does not pair dating with friends',
      a: { desiredCompany: 'dating' },
      b: { desiredCompany: 'friends' },
      expected: false,
    },
    {
      title: 'does not pair company with dating',
      a: { desiredCompany: 'company' },
      b: { desiredCompany: 'dating' },
      expected: false,
    },
    {
      title: 'pairs users who share one of several days',
      a: { sessionIds: ['day-1', 'day-2'] },
      b: { sessionIds: ['day-2', 'day-3'] },
      expected: true,
    },
    {
      title: 'does not pair users with no day in common',
      a: { sessionIds: ['day-1'] },
      b: { sessionIds: ['day-2'] },
      expected: false,
    },
  ];

  for (const { title, a, b, expected } of cases) {
    test(title, () => {
      assert.equal(canPair(aMember(a), aMember(b)), expected);
    });
  }
});

// Score = 0.7 × interests + 0.2 × same company + 0.1 × after-event plans (matching.md, policy).
describe('pairScore', () => {
  const cases: { title: string; a: Partial<PoolMember>; b: Partial<PoolMember>; expected: number }[] = [
    { title: 'is 1 for the same interests, company and plans', a: {}, b: {}, expected: 1 },
    {
      title: 'counts shared interests over all distinct ones',
      // 1 shared (jazz) of 3 distinct; the sport heading is not shared.
      a: { interests: [JAZZ, HIKING] },
      b: { interests: [JAZZ, CHESS] },
      expected: 0.533,
    },
    {
      title: 'gives half credit for a heading both have without a shared interest',
      // No shared interest, music shared, 2 distinct: 0.5 / 2.
      a: { interests: [JAZZ] },
      b: { interests: [INDIE] },
      expected: 0.475,
    },
    {
      title: 'gives no heading credit where an interest under it is already shared',
      // jazz shared, music already counted: 1 of 3 distinct.
      a: { interests: [JAZZ, ROCK] },
      b: { interests: [JAZZ, INDIE] },
      expected: 0.533,
    },
    {
      title: 'adds shared interests and shared headings',
      // jazz shared, sport shared only by heading: (1 + 0.5) / 3 distinct.
      a: { interests: [JAZZ, HIKING] },
      b: { interests: [JAZZ, YOGA] },
      expected: 0.65,
    },
    {
      title: 'scores no interests on either side as no overlap',
      a: { interests: [] },
      b: { interests: [] },
      expected: 0.3,
    },
    {
      title: 'loses the company part for different kinds of company',
      a: { desiredCompany: 'friends' },
      b: { desiredCompany: 'company' },
      expected: 0.8,
    },
    {
      title: 'counts shared plans over all distinct ones',
      a: { afterEventPlans: ['walk', 'coffee'] },
      b: { afterEventPlans: ['coffee', 'dinner'] },
      expected: 0.933,
    },
    {
      title: 'loses the plans part when only one wants to stay on after the event',
      a: { afterEventPlans: ['walk'] },
      b: { afterEventPlans: [] },
      expected: 0.9,
    },
  ];

  for (const { title, a, b, expected } of cases) {
    test(title, () => {
      assert.equal(pairScore(aMember(a), aMember(b)), expected);
    });
  }

  test('is the same in either order', () => {
    const a = aMember({ interests: [JAZZ, HIKING, CHESS], afterEventPlans: ['walk'] });
    const b = aMember({ interests: [INDIE, YOGA], desiredCompany: 'friends' });

    assert.equal(pairScore(a, b), pairScore(b, a));
  });
});
