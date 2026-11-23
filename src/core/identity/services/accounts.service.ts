// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../common/transaction.ts';
import { AccountsRepository } from '../repositories/accounts.repository.ts';
import type { Account } from '../types/account.ts';
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

  /** By account, as YYYY-MM-DD; accounts that are unknown or have none are left out. */
  async getDatesOfBirth(accountIds: string[], tx?: Transaction): Promise<Map<string, string>> {
    return this.accountsRepository.findDatesOfBirth(accountIds, tx);
  }

  /** The account's verified phone number; null without one, as with Google sign-in, or for an unknown account. */
  async getPhone(accountId: string): Promise<string | null> {
    return (await this.accountsRepository.findById(accountId))?.phone ?? null;
  }

  /** The account's role and status; undefined for an unknown account. */
  async findStanding(accountId: string): Promise<Pick<Account, 'role' | 'status'> | undefined> {
    const account = await this.accountsRepository.findById(accountId);
    return account && { role: account.role, status: account.status };
  }

  /** Bans the account and ends its sessions; the next request with any of its tokens gets 401 (FR-027). */
  async ban(accountId: string): Promise<void> {
    await this.accountsRepository.setStatus(accountId, 'banned');
    await this.sessionsService.endAll(accountId);
  }

  /** The banned ones of `accountIds`. */
  async findBanned(accountIds: string[], tx?: Transaction): Promise<string[]> {
    return this.accountsRepository.findIdsWithStatus(accountIds, 'banned', tx);
  }

  async stats(): Promise<{ users: number }> {
    return { users: await this.accountsRepository.countByStatus('active') };
  }
}
