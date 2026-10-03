// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ProfilesRepository } from '../repositories/profiles.repository.js';
import type { ProfileSummary } from '../types/profile.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly profilesRepository: ProfilesRepository) {}

  /** Summaries by account id; accounts without a profile are left out. */
  async getSummaries(accountIds: string[]): Promise<Map<string, ProfileSummary>> {
    const summaries = await this.profilesRepository.findSummaries([...new Set(accountIds)]);
    return new Map(summaries.map((summary) => [summary.accountId, summary]));
  }
}
