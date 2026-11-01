// Written with the help of Claude
import type { Account, AccountRecord, GoogleLinkResult, PasswordCredential, SignInLockout } from '../types/account.ts';

export abstract class AccountsRepository {
  abstract findById(accountId: string): Promise<Account | undefined>;

  abstract findByPhone(phone: string): Promise<Account | undefined>;

  /** Undefined when no account has this phone or the account has no password. */
  abstract findPasswordCredential(phone: string): Promise<PasswordCredential | undefined>;

  /** Creates the account without sign-in methods; the user adds them after registration. */
  abstract create(account: AccountRecord): Promise<Account>;

  /** Creates a pending account with the Google sign-in method; a parallel request for the same subject gets its account. */
  abstract createWithGoogle(subject: string): Promise<Account>;

  /** Saves the date of birth of a pending account and makes it active. */
  abstract activate(accountId: string, dateOfBirth: string): Promise<void>;

  abstract delete(accountId: string): Promise<void>;

  /** Undefined when the account has no password yet. */
  abstract findPasswordHash(accountId: string): Promise<string | undefined>;

  /** Adds the password sign-in method, or replaces the password if there is one. */
  abstract setPasswordHash(accountId: string, passwordHash: string): Promise<void>;

  abstract findByGoogleSubject(subject: string): Promise<Account | undefined>;

  /** Undefined when the account has no Google account linked. */
  abstract findGoogleSubject(accountId: string): Promise<string | undefined>;

  /** Adds the Google sign-in method, unless another account has this subject or this account has a Google account. */
  abstract linkGoogle(accountId: string, subject: string): Promise<GoogleLinkResult>;

  /**
   * Replaces the lockout state with `change(current state)` and returns the new state, in one step,
   * so concurrent sign-ins all see each other's failures (SEC-007).
   */
  abstract updateLockout(accountId: string, change: (lockout: SignInLockout) => SignInLockout): Promise<SignInLockout>;

  /** The account's date of birth as YYYY-MM-DD; undefined for an unknown account. */
  abstract findDateOfBirth(accountId: string): Promise<string | undefined>;
}
