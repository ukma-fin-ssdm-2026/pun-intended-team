// Written with the help of Claude
const MAX_FAILED_SIGN_INS = 5;
const LOCK_MS = 15 * 60 * 1000;

/** What an account stores to lock out password guessing (SEC-007). */
export interface SignInLockout {
  failedSignins: number;
  failedSigninsSince: Date | null;
  lockedUntil: Date | null;
}

const NO_FAILURES = { failedSignins: 0, failedSigninsSince: null };

/** The lockout state to save after a failed sign-in. */
export function afterFailedSignIn(state: SignInLockout, now: Date): SignInLockout {
  const failedSignins = state.failedSignins + 1;
  if (failedSignins >= MAX_FAILED_SIGN_INS) {
    return { ...NO_FAILURES, lockedUntil: new Date(now.getTime() + LOCK_MS) };
  }
  return { ...state, failedSignins, failedSigninsSince: state.failedSigninsSince ?? now };
}
