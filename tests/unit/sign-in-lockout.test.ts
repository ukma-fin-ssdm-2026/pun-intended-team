// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fc from 'fast-check';
import { afterFailedSignIn, isLocked } from '../../dist/core/identity/services/sign-in-lockout.js';
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

// SEC-007: 5 failed sign-ins for one account within 15 minutes lock it for 15 minutes.
describe('afterFailedSignIn', () => {
  test('counts a failure before the 5th without locking', () => {
    const before = aLockout({ failedSignins: 3, failedSigninsSince: minute(0) });

    const after = afterFailedSignIn(before, minute(6));

    assert.deepEqual(after, aLockout({ failedSignins: 4, failedSigninsSince: minute(0) }));
  });

  test('locks the account for 15 minutes at the 5th failure and clears the count', () => {
    const before = aLockout({ failedSignins: 4, failedSigninsSince: minute(0) });
    const fifthFailure = minute(8);

    const after = afterFailedSignIn(before, fifthFailure);

    assert.deepEqual(after, aLockout({ lockedUntil: minute(8 + LOCK_MINUTES) }));
  });

  test('starts the window at the first failure', () => {
    const before = aLockout();

    const after = afterFailedSignIn(before, minute(0));

    assert.deepEqual(after, aLockout({ failedSignins: 1, failedSigninsSince: minute(0) }));
  });

  test('locks at the 5th failure in the last moment of the window', () => {
    const before = aLockout({ failedSignins: 4, failedSigninsSince: minute(0) });
    const lastMoment = new Date(minute(WINDOW_MINUTES).getTime() - 1);

    const after = afterFailedSignIn(before, lastMoment);

    assert.deepEqual(after, aLockout({ lockedUntil: new Date(lastMoment.getTime() + LOCK_MINUTES * 60 * 1000) }));
  });

  test('starts a new count once the window has passed', () => {
    const before = aLockout({ failedSignins: 4, failedSigninsSince: minute(0) });

    const after = afterFailedSignIn(before, minute(WINDOW_MINUTES));

    assert.deepEqual(after, aLockout({ failedSignins: 1, failedSigninsSince: minute(WINDOW_MINUTES) }));
  });
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
