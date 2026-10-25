// Written with the help of Claude
import type { SignInLockout } from '../types/account.ts';

const MAX_FAILED_SIGN_INS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

const NO_FAILURES: Pick<SignInLockout, 'failedSignins' | 'failedSigninsSince'> = {
  failedSignins: 0,
  failedSigninsSince: null,
};

/** No failed sign-ins and no lock: the state of a new account and after a successful sign-in. */
export const NO_LOCKOUT: SignInLockout = { ...NO_FAILURES, lockedUntil: null };

/** The lockout state to save after a failed sign-in. */
export function afterFailedSignIn(state: SignInLockout, now: Date): SignInLockout {
  const windowPassed =
    state.failedSigninsSince !== null && now.getTime() - state.failedSigninsSince.getTime() >= WINDOW_MS;
  const counted = windowPassed ? { ...state, ...NO_FAILURES } : state;
  const failedSignins = counted.failedSignins + 1;
  if (failedSignins >= MAX_FAILED_SIGN_INS) {
    return { ...NO_FAILURES, lockedUntil: new Date(now.getTime() + LOCK_MS) };
  }
  const failedSigninsSince = counted.failedSigninsSince ?? now;
  return { ...counted, failedSignins, failedSigninsSince };
}

/** The lockout state to save after a sign-in: a locked account stays as it is, whatever the password. */
export function afterSignIn(state: SignInLockout, passwordMatches: boolean, now: Date): SignInLockout {
  if (isLocked(state, now)) {
    return state;
  }
  return passwordMatches ? NO_LOCKOUT : afterFailedSignIn(state, now);
}

export function isLocked(state: SignInLockout, now: Date): boolean {
  return state.lockedUntil !== null && now < state.lockedUntil;
}
