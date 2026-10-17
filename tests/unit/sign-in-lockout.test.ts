// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { lockedUntil } from '../../dist/core/identity/services/sign-in-lockout.js';
import { NOW } from './fixtures/clock.ts';

const LOCK_MINUTES = 15; // SEC-007

/** A moment on a test timeline in minutes, where minute 0 is NOW. */
function minute(n: number): Date {
  return new Date(NOW.getTime() + n * 60 * 1000);
}

// SEC-007: 5 failed sign-ins for one account within 15 minutes lock it for 15 minutes.
describe('lockedUntil', () => {
  test('locks the account for 15 minutes from the 5th failure', () => {
    const fifthFailure = minute(8);
    const failures = [minute(0), minute(2), minute(4), minute(6), fifthFailure];
    const nextAttempt = minute(9);

    const until = lockedUntil(failures, nextAttempt);

    assert.deepEqual(until, minute(8 + LOCK_MINUTES));
  });

  test('leaves the account open after 4 failures', () => {
    const failures = [minute(0), minute(2), minute(4), minute(6)];
    const nextAttempt = minute(7);

    const until = lockedUntil(failures, nextAttempt);

    assert.equal(until, undefined);
  });
});
