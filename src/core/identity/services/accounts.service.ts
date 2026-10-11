// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { AccountsRepository } from '../repositories/accounts.repository.ts';

@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  /** The account's date of birth as YYYY-MM-DD; undefined for an unknown account. */
  async getDateOfBirth(accountId: string): Promise<string | undefined> {
    return this.accountsRepository.findDateOfBirth(accountId);
  }
}
