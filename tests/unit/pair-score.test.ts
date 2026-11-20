// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { accepts, canPair, pairScore } from '../../dist/core/matching/services/pair-score.js';
import type { PoolMember } from '../../src/core/matching/types/matching.ts';
import { ACCEPTS_ANYONE } from './fixtures/matching.ts';

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
    ...ACCEPTS_ANYONE,
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
    {
      title: 'pairs a woman and a man who each want the other’s gender',
      a: { gender: 'female', preferredGender: 'male' },
      b: { gender: 'male', preferredGender: 'female' },
      expected: true,
    },
    {
      title: 'does not pair when the first does not want the second’s gender',
      a: { gender: 'female', preferredGender: 'female' },
      b: { gender: 'male', preferredGender: 'any' },
      expected: false,
    },
    {
      title: 'does not pair when the second does not want the first’s gender',
      a: { gender: 'male', preferredGender: 'any' },
      b: { gender: 'female', preferredGender: 'female' },
      expected: false,
    },
    {
      title: 'does not pair when the second is outside the first’s age range',
      a: { ageMin: 30, ageMax: 40 },
      b: { age: 25 },
      expected: false,
    },
    {
      title: 'does not pair when the first is outside the second’s age range',
      a: { age: 25 },
      b: { ageMin: 30, ageMax: 40 },
      expected: false,
    },
  ];

  for (const { title, a, b, expected } of cases) {
    test(title, () => {
      assert.equal(canPair(aMember(a), aMember(b)), expected);
    });
  }
});

// matching.md, policy: whom a user wants to go with; canPair checks it both ways.
describe('accepts', () => {
  const cases: { title: string; member: Partial<PoolMember>; other: Partial<PoolMember>; expected: boolean }[] = [
    { title: '"any" accepts a woman', member: { preferredGender: 'any' }, other: { gender: 'female' }, expected: true },
    { title: '"any" accepts a man', member: { preferredGender: 'any' }, other: { gender: 'male' }, expected: true },
    { title: '"any" accepts "other"', member: { preferredGender: 'any' }, other: { gender: 'other' }, expected: true },
    {
      title: '"any" accepts a profile without a gender yet',
      member: { preferredGender: 'any' },
      other: { gender: null },
      expected: true,
    },
    {
      title: '"female" accepts a woman',
      member: { preferredGender: 'female' },
      other: { gender: 'female' },
      expected: true,
    },
    {
      title: '"female" refuses a man',
      member: { preferredGender: 'female' },
      other: { gender: 'male' },
      expected: false,
    },
    {
      title: '"female" refuses "other"',
      member: { preferredGender: 'female' },
      other: { gender: 'other' },
      expected: false,
    },
    { title: '"male" accepts a man', member: { preferredGender: 'male' }, other: { gender: 'male' }, expected: true },
    {
      title: '"male" refuses a woman',
      member: { preferredGender: 'male' },
      other: { gender: 'female' },
      expected: false,
    },
    {
      title: '"male" refuses "other"',
      member: { preferredGender: 'male' },
      other: { gender: 'other' },
      expected: false,
    },
    {
      title: '"male" refuses a profile without a gender',
      member: { preferredGender: 'male' },
      other: { gender: null },
      expected: false,
    },
    {
      title: 'accepts exactly the youngest age',
      member: { ageMin: 25, ageMax: 30 },
      other: { age: 25 },
      expected: true,
    },
    { title: 'accepts exactly the oldest age', member: { ageMin: 25, ageMax: 30 }, other: { age: 30 }, expected: true },
    {
      title: 'refuses a year below the range',
      member: { ageMin: 25, ageMax: 30 },
      other: { age: 24 },
      expected: false,
    },
    {
      title: 'refuses a year above the range',
      member: { ageMin: 25, ageMax: 30 },
      other: { age: 31 },
      expected: false,
    },
    {
      title: 'accepts any age above the youngest without an upper bound ("60+")',
      member: { ageMin: 60, ageMax: null },
      other: { age: 87 },
      expected: true,
    },
  ];

  for (const { title, member, other, expected } of cases) {
    test(title, () => {
      assert.equal(accepts(aMember(member), aMember(other)), expected);
    });
  }
});

// A user whose gender is "other" goes only with those who accept anyone.
describe('canPair with the gender "other"', () => {
  test('pairs with someone who accepts anyone', () => {
    assert.equal(canPair(aMember({ gender: 'other' }), aMember({ preferredGender: 'any' })), true);
  });

  for (const preferredGender of ['female', 'male'] as const) {
    test(`does not pair with someone who wants "${preferredGender}"`, () => {
      assert.equal(canPair(aMember({ gender: 'other' }), aMember({ gender: preferredGender, preferredGender })), false);
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
