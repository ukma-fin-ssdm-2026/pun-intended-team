// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { acceptedStatus, sidesOf, viewStatus } from '../../dist/core/matching/services/match-sides.js';
import type { Application } from '../../dist/core/matching/types/application.js';
import type { MatchRecord, MatchStatus } from '../../dist/core/matching/types/match.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';
import { NOW } from './fixtures/clock.ts';

const LATER = '2026-10-16T09:00:00.000Z';
const EARLIER = '2026-10-15T08:00:00.000Z';

function anApplication(id: string, userId: string): Application {
  return {
    id,
    userId,
    eventId: 'event-1',
    sessionIds: ['day-1'],
    desiredCompany: 'company',
    afterEventPlans: [],
    status: 'paired',
    createdAt: EARLIER,
  };
}

const MATCH: MatchRecord = {
  id: 'match-1',
  applicationAId: 'application-a',
  applicationBId: 'application-b',
  source: 'round',
  score: 0.7,
  seed: 1,
  status: 'proposed',
  validUntil: LATER,
  createdAt: EARLIER,
  eventId: 'event-1',
  applicationA: anApplication('application-a', ACCOUNT_ID),
  applicationB: anApplication('application-b', OTHER_ACCOUNT_ID),
};

describe('sidesOf', () => {
  test('gives the caller’s application and the other’s, on either side', () => {
    assert.deepEqual(sidesOf(MATCH, ACCOUNT_ID), { side: 'a', own: MATCH.applicationA, other: MATCH.applicationB });
    assert.deepEqual(sidesOf(MATCH, OTHER_ACCOUNT_ID), {
      side: 'b',
      own: MATCH.applicationB,
      other: MATCH.applicationA,
    });
  });

  test('is undefined for someone who takes no part', () => {
    assert.equal(sidesOf(MATCH, 'a0000000-0000-4000-8000-000000000003'), undefined);
  });
});

// UC-001 steps 8–9: the other's acceptance stays hidden until both accepted.
describe('viewStatus', () => {
  for (const [status, side, expected] of [
    ['proposed', 'a', 'proposed'],
    ['accepted_a', 'a', 'accepted'],
    ['accepted_a', 'b', 'proposed'],
    ['accepted_b', 'b', 'accepted'],
    ['accepted_b', 'a', 'proposed'],
    ['mutual', 'a', 'mutual'],
    ['declined', 'b', 'declined'],
    ['cancelled', 'a', 'cancelled'],
    ['expired', 'a', 'expired'],
  ] as const) {
    test(`shows ${status} to side ${side} as ${expected}`, () => {
      assert.equal(viewStatus(status, LATER, side, NOW), expected);
    });
  }

  for (const status of ['proposed', 'accepted_a', 'accepted_b'] as const) {
    test(`shows a ${status} proposal past its valid_until as expired`, () => {
      assert.equal(viewStatus(status, EARLIER, 'a', NOW), 'expired');
    });
  }

  test('keeps a mutual match mutual after its valid_until', () => {
    assert.equal(viewStatus('mutual', EARLIER, 'a', NOW), 'mutual');
  });
});

describe('acceptedStatus', () => {
  for (const [status, side, expected] of [
    ['proposed', 'a', 'accepted_a'],
    ['proposed', 'b', 'accepted_b'],
    ['accepted_b', 'a', 'mutual'],
    ['accepted_a', 'b', 'mutual'],
  ] as [MatchStatus, 'a' | 'b', MatchStatus][]) {
    test(`moves ${status} accepted by side ${side} to ${expected}`, () => {
      assert.equal(acceptedStatus(status, side), expected);
    });
  }
});
