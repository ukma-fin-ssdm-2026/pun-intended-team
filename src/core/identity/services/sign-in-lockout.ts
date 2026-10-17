// Written with the help of Claude
/** What an account stores to lock out password guessing (SEC-007). */
export interface SignInLockout {
  failedSignins: number;
  failedSigninsSince: Date | null;
  lockedUntil: Date | null;
}

/** The lockout state to save after a failed sign-in. */
export function afterFailedSignIn(state: SignInLockout, now: Date): SignInLockout {
  const failedSignins = state.failedSignins + 1;
  if (failedSignins >= 5) {
    return { failedSignins: 0, failedSigninsSince: null, lockedUntil: new Date(now.getTime() + 15 * 60 * 1000) };
  }
  return { ...state, failedSignins };
}
