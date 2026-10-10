// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { AccountsRepository } from '../../core/identity/repositories/accounts.repository.ts';
import { datesOfBirth } from './data.ts';

@Injectable()
export class StubAccountsRepository implements AccountsRepository {
  async findDateOfBirth(accountId: string): Promise<string | undefined> {
    // A lookup by comparison, not datesOfBirth[accountId]: no key is ever read from the object's prototype.
    return Object.entries(datesOfBirth).find(([id]) => id === accountId)?.[1];
  }
}
