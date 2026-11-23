// Written with the help of Claude
import type { AccountRole } from './caller.ts';

/** `pending` from the verified code until the age check passes (SAFE-001). */
export type AccountStatus = 'pending' | 'active' | 'banned';

export interface Account {
  id: string;
  /** E.164, e.g. +380501234567; null for an account registered with Google. */
  phone: string | null;
  role: AccountRole;
  status: AccountStatus;
  /** YYYY-MM-DD; null while the account is pending. */
  dateOfBirth: string | null;
}

export type SignInMethod = 'google' | 'password';

/** An account as the admin panel lists it; the date of birth only gives the age, the contact never leaves. */
export interface AccountOverview {
  id: string;
  role: AccountRole;
  status: AccountStatus;
  signInMethods: SignInMethod[];
  /** YYYY-MM-DD; null while the account is pending. */
  dateOfBirth: string | null;
  createdAt: string;
}

/** Which accounts the admin panel lists; `ids` limits them to these, e.g. the ones a profile search found. */
export interface AccountFilter {
  role?: AccountRole;
  status?: AccountStatus;
  ids?: string[];
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
