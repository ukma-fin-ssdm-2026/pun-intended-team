// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fc from 'fast-check';
import { afterFailedSignIn, afterSignIn, isLocked } from '../../dist/core/identity/services/sign-in-lockout.js';
import type { SignInLockout } from '../../dist/core/identity/types/account.js';
import { NOW } from './fixtures/clock.ts';

const WINDOW_MINUTES = 15; // SEC-007
const LOCK_MINUTES = 15; // SEC-007

/** A moment on a test timeline in minutes, where minute 0 is NOW. */
function minute(n: number): Date {
  return new Date(NOW.getTime() + n * 60 * 1000);
}

/** An account with no failed sign-ins and no lock. */
function aLockout(overrides: Partial<SignInLockout> = {}): SignInLockout {
  return { failedSignins: 0, failedSigninsSince: null, lockedUntil: null, ...overrides };
}

const LOCKED = aLockout({ lockedUntil: minute(LOCK_MINUTES) });
const LAST_MOMENT_OF_WINDOW = new Date(minute(WINDOW_MINUTES).getTime() - 1);
const LAST_MOMENT_OF_LOCK = new Date(minute(LOCK_MINUTES).getTime() - 1);

// SEC-007: 5 failed sign-ins for one account within 15 minutes lock it for 15 minutes.
// One case per row of the state transition table in docs/testing/testing-strategy.md (Bonuses).
describe('afterSignIn, state transitions', () => {
  const transitions = [
    {
      id: 'T1',
      from: 'Clean',
      event: 'wrong password',
      to: 'Counting(1)',
      state: aLockout(),
      passwordMatches: false,
      now: minute(0),
      expected: aLockout({ failedSignins: 1, failedSigninsSince: minute(0) }),
    },
    {
      id: 'T2',
      from: 'Clean',
      event: 'right password',
      to: 'Clean',
      state: aLockout(),
      passwordMatches: true,
      now: minute(0),
      expected: aLockout(),
    },
    {
      id: 'T3',
      from: 'Counting(n < 4)',
      event: 'wrong password inside the window',
      to: 'Counting(n + 1)',
      state: aLockout({ failedSignins: 3, failedSigninsSince: minute(0) }),
      passwordMatches: false,
      now: minute(6),
      expected: aLockout({ failedSignins: 4, failedSigninsSince: minute(0) }),
    },
    {
      id: 'T4',
      from: 'Counting(4)',
      event: 'wrong password inside the window',
      to: 'Locked',
      state: aLockout({ failedSignins: 4, failedSigninsSince: minute(0) }),
      passwordMatches: false,
      now: LAST_MOMENT_OF_WINDOW,
      expected: aLockout({ lockedUntil: new Date(LAST_MOMENT_OF_WINDOW.getTime() + LOCK_MINUTES * 60 * 1000) }),
    },
    {
      id: 'T5',
      from: 'Counting(n)',
      event: 'wrong password after the window',
      to: 'Counting(1)',
      state: aLockout({ failedSignins: 4, failedSigninsSince: minute(0) }),
      passwordMatches: false,
      now: minute(WINDOW_MINUTES),
      expected: aLockout({ failedSignins: 1, failedSigninsSince: minute(WINDOW_MINUTES) }),
    },
    {
      id: 'T6',
      from: 'Counting(n)',
      event: 'right password',
      to: 'Clean',
      state: aLockout({ failedSignins: 4, failedSigninsSince: minute(0) }),
      passwordMatches: true,
      now: minute(6),
      expected: aLockout(),
    },
    {
      id: 'T7',
      from: 'Locked',
      event: 'wrong password before the lock ends',
      to: 'Locked',
      state: LOCKED,
      passwordMatches: false,
      now: LAST_MOMENT_OF_LOCK,
      expected: LOCKED,
    },
    {
      id: 'T8',
      from: 'Locked',
      event: 'right password before the lock ends',
      to: 'Locked',
      state: LOCKED,
      passwordMatches: true,
      now: LAST_MOMENT_OF_LOCK,
      expected: LOCKED,
    },
    {
      id: 'T9',
      from: 'Locked',
      event: 'wrong password once the lock ends',
      to: 'Counting(1)',
      state: LOCKED,
      passwordMatches: false,
      now: minute(LOCK_MINUTES),
      expected: aLockout({
        failedSignins: 1,
        failedSigninsSince: minute(LOCK_MINUTES),
        lockedUntil: minute(LOCK_MINUTES),
      }),
    },
    {
      id: 'T10',
      from: 'Locked',
      event: 'right password once the lock ends',
      to: 'Clean',
      state: LOCKED,
      passwordMatches: true,
      now: minute(LOCK_MINUTES),
      expected: aLockout(),
    },
  ];

  for (const { id, from, event, to, state, passwordMatches, now, expected } of transitions) {
    test(`${id}: ${from} --${event}--> ${to}`, () => {
      assert.deepEqual(afterSignIn(state, passwordMatches, now), expected);
    });
  }
});

describe('isLocked', () => {
  const cases = [
    { title: 'is not locked without a lock', state: aLockout(), now: minute(0), locked: false },
    {
      title: 'is locked before the lock ends',
      state: aLockout({ lockedUntil: minute(LOCK_MINUTES) }),
      now: minute(14),
      locked: true,
    },
    {
      title: 'is not locked from the moment the lock ends',
      state: aLockout({ lockedUntil: minute(LOCK_MINUTES) }),
      now: minute(LOCK_MINUTES),
      locked: false,
    },
  ];

  for (const { title, state, now, locked } of cases) {
    test(title, () => {
      assert.equal(isLocked(state, now), locked);
    });
  }
});

// Property-based: fast-check makes up the failures, so this holds for any timeline, not only the ones above.
describe('afterFailedSignIn, for any sequence of failed sign-ins', () => {
  test('only produces states the database accepts', () => {
    const minutesBetweenFailures = fc.array(fc.nat({ max: 60 }), { maxLength: 50 });

    fc.assert(
      fc.property(minutesBetweenFailures, (gaps) => {
        let state = aLockout();
        let minutes = 0;
        for (const gap of gaps) {
          minutes += gap;
          state = afterFailedSignIn(state, minute(minutes));

          // accounts_failed_signins_window_check and the threshold of 5 (SEC-007).
          assert.equal(state.failedSignins === 0, state.failedSigninsSince === null);
          assert.ok(state.failedSignins >= 0 && state.failedSignins < 5);
        }
      }),
    );
  });
});
