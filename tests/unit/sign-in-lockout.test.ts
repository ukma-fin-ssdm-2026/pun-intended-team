// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { afterFailedSignIn, type SignInLockout } from '../../dist/core/identity/services/sign-in-lockout.js';
import { NOW } from './fixtures/clock.ts';

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
});
