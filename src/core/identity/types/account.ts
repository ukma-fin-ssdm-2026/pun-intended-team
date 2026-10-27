// Written with the help of Claude
import type { AccountRole } from './caller.ts';

/** `pending` from the verified code until the age check passes (SAFE-001). */
export type AccountStatus = 'pending' | 'active' | 'banned';

export interface Account {
  id: string;
  /** E.164, e.g. +380501234567. */
  phone: string;
  role: AccountRole;
  status: AccountStatus;
  /** YYYY-MM-DD; null while the account is pending. */
  dateOfBirth: string | null;
}

/** A new row as the repository stores it. */
export type AccountRecord = Omit<Account, 'id'>;

/** What an account stores to lock out password guessing (SEC-007). */
export interface SignInLockout {
  failedSignins: number;
  failedSigninsSince: Date | null;
  lockedUntil: Date | null;
}

/** Whether the Google sign-in method was added, or which unique rule refused it. */
export type GoogleLinkResult = 'linked' | 'subject-taken' | 'account-has-google';

/** What password sign-in needs; the hash never leaves the identity module. */
export interface PasswordCredential {
  accountId: string;
  role: AccountRole;
  status: AccountStatus;
  passwordHash: string;
}
