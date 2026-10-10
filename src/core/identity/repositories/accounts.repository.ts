// Written with the help of Claude
import type { Account, AccountRecord, PasswordCredential } from '../types/account.ts';

export abstract class AccountsRepository {
  abstract existsByPhone(phone: string): Promise<boolean>;

  /** Undefined when no account has this phone or the account has no password. */
  abstract findPasswordCredential(phone: string): Promise<PasswordCredential | undefined>;

  /** Creates the account together with its password sign-in method. */
  abstract create(account: AccountRecord, passwordHash: string): Promise<Account>;
}
