// Written with the help of Claude
import type { PoolInterest, PoolMember } from '../types/matching.ts';
import { interestOverlap } from './interest-overlap.ts';

const INTEREST_WEIGHT = 0.7;
const COMPANY_WEIGHT = 0.2;
const PLANS_WEIGHT = 0.1;
const SHARED_GROUP_CREDIT = 0.5;

/** Whether two users may be paired at all: dating only with dating, and at least one day both can go. */
export function canPair(a: PoolMember, b: PoolMember): boolean {
  const sessionsB = new Set(b.sessionIds);
  return (
    (a.desiredCompany === 'dating') === (b.desiredCompany === 'dating') && a.sessionIds.some((id) => sessionsB.has(id))
  );
}

/** How well two users suit each other, 0–1, rounded to the 3 decimals a Match stores (matching.md, policy). */
export function pairScore(a: PoolMember, b: PoolMember): number {
  const score =
    INTEREST_WEIGHT * interestScore(a.interests, b.interests) +
    COMPANY_WEIGHT * (a.desiredCompany === b.desiredCompany ? 1 : 0) +
    PLANS_WEIGHT * plansScore(a.afterEventPlans, b.afterEventPlans);
  return Math.round(score * 1000) / 1000;
}

/** Shared interests count 1, and a heading both have without a shared interest under it counts 0.5. */
function interestScore(a: PoolInterest[], b: PoolInterest[]): number {
  const idsA = a.map(({ id }) => id);
  const idsB = b.map(({ id }) => id);
  const distinct = new Set([...idsA, ...idsB]).size;
  if (distinct === 0) return 0;
  const shared = new Set(idsA).intersection(new Set(idsB));
  const groupsWithShared = new Set(a.filter(({ id }) => shared.has(id)).map(({ group }) => group));
  const groupsOnlyShared = new Set(a.map(({ group }) => group))
    .intersection(new Set(b.map(({ group }) => group)))
    .difference(groupsWithShared).size;
  return interestOverlap(idsA, idsB) + (SHARED_GROUP_CREDIT * groupsOnlyShared) / distinct;
}

/** Two users who both want only the event agree as much as two with the same plans. */
function plansScore(a: string[], b: string[]): number {
  return a.length === 0 && b.length === 0 ? 1 : interestOverlap(a, b);
}
