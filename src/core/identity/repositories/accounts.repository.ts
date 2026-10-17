// Written with the help of Claude
import type { Account, AccountRecord, PasswordCredential, SignInLockout } from '../types/account.ts';

export abstract class AccountsRepository {
  abstract existsByPhone(phone: string): Promise<boolean>;

  abstract findByPhone(phone: string): Promise<Account | undefined>;

  /** Undefined when no account has this phone or the account has no password. */
  abstract findPasswordCredential(phone: string): Promise<PasswordCredential | undefined>;

  /** Creates the account without sign-in methods; the user adds them after registration. */
  abstract create(account: AccountRecord): Promise<Account>;

  /** Undefined when the account has no password yet. */
  abstract findPasswordHash(accountId: string): Promise<string | undefined>;

  /** Adds the password sign-in method, or replaces the password if there is one. */
  abstract setPasswordHash(accountId: string, passwordHash: string): Promise<void>;

  abstract saveLockout(accountId: string, lockout: SignInLockout): Promise<void>;

  /** The account's date of birth as YYYY-MM-DD; undefined for an unknown account. */
  abstract findDateOfBirth(accountId: string): Promise<string | undefined>;
}
