// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { AccountsRepository } from '../repositories/accounts.repository.ts';
import { SessionsService } from './sessions.service.ts';

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly sessionsService: SessionsService,
  ) {}

  /** The account's date of birth as YYYY-MM-DD; undefined for an unknown account. */
  async getDateOfBirth(accountId: string): Promise<string | undefined> {
    return this.accountsRepository.findDateOfBirth(accountId);
  }

  /** Bans the account and ends its sessions; the next request with any of its tokens gets 401 (FR-027). */
  async ban(accountId: string): Promise<void> {
    await this.accountsRepository.setStatus(accountId, 'banned');
    await this.sessionsService.endAll(accountId);
  }

  async stats(): Promise<{ users: number }> {
    return { users: await this.accountsRepository.countByStatus('active') };
  }
}
