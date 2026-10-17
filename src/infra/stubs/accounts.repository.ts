// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountsRepository } from '../../core/identity/repositories/accounts.repository.ts';
import type { Account, AccountRecord, PasswordCredential } from '../../core/identity/types/account.ts';
import { type StoredAccount, storedAccounts } from './data.ts';

@Injectable()
export class StubAccountsRepository implements AccountsRepository {
  async existsByPhone(phone: string): Promise<boolean> {
    return storedAccounts.some((account) => account.phone === phone);
  }

  async findByPhone(phone: string): Promise<Account | undefined> {
    const stored = storedAccounts.find((account) => account.phone === phone);
    if (!stored) {
      return undefined;
    }
    const { passwordHash, ...account } = stored;
    return account;
  }

  async findPasswordCredential(phone: string): Promise<PasswordCredential | undefined> {
    const account = storedAccounts.find((account) => account.phone === phone);
    if (!account?.passwordHash) {
      return undefined;
    }
    const { id: accountId, role, status, passwordHash } = account;
    return { accountId, role, status, passwordHash };
  }

  async create(record: AccountRecord): Promise<Account> {
    const account: Account = { id: randomUUID(), ...record };
    storedAccounts.push({ ...account, passwordHash: null });
    return account;
  }

  async findPasswordHash(accountId: string): Promise<string | undefined> {
    return this.byId(accountId).passwordHash ?? undefined;
  }

  async setPasswordHash(accountId: string, passwordHash: string): Promise<void> {
    this.byId(accountId).passwordHash = passwordHash;
  }

  async findDateOfBirth(accountId: string): Promise<string | undefined> {
    return storedAccounts.find((account) => account.id === accountId)?.dateOfBirth;
  }

  private byId(accountId: string): StoredAccount {
    const account = storedAccounts.find((account) => account.id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} does not exist`);
    }
    return account;
  }
}
