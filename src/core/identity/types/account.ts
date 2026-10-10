// Written with the help of Claude
import type { AccountRole } from './caller.ts';

export type AccountStatus = 'active' | 'banned';

export interface Account {
  id: string;
  /** E.164, e.g. +380501234567. */
  phone: string;
  role: AccountRole;
  status: AccountStatus;
  /** YYYY-MM-DD. */
  dateOfBirth: string;
}

/** A new row as the repository stores it. */
export type AccountRecord = Omit<Account, 'id'>;

/** What password sign-in needs; the hash never leaves the identity module. */
export interface PasswordCredential {
  accountId: string;
  role: AccountRole;
  status: AccountStatus;
  passwordHash: string;
}
