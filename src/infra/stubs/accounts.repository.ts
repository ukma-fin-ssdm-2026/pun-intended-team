// Written with the help of Claude
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountsRepository } from '../../core/identity/repositories/accounts.repository.ts';
import type { Account, AccountRecord, PasswordCredential } from '../../core/identity/types/account.ts';
import { storedAccounts } from './data.ts';

@Injectable()
export class StubAccountsRepository implements AccountsRepository {
  async existsByPhone(phone: string): Promise<boolean> {
    return storedAccounts.some((account) => account.phone === phone);
  }

  async findPasswordCredential(phone: string): Promise<PasswordCredential | undefined> {
    const account = storedAccounts.find((account) => account.phone === phone);
    if (!account?.passwordHash) {
      return undefined;
    }
    const { id: accountId, role, status, passwordHash } = account;
    return { accountId, role, status, passwordHash };
  }

  async create(record: AccountRecord, passwordHash: string): Promise<Account> {
    const account: Account = { id: randomUUID(), ...record };
    storedAccounts.push({ ...account, passwordHash });
    return account;
  }

  async findDateOfBirth(accountId: string): Promise<string | undefined> {
    return storedAccounts.find((account) => account.id === accountId)?.dateOfBirth;
  }
}
