// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ProfilesRepository } from '../../core/profiles/repositories/profiles.repository.ts';
import type { ProfileSummary } from '../../core/profiles/types/profile.ts';
import { profiles } from './data.ts';

@Injectable()
export class StubProfilesRepository implements ProfilesRepository {
  async findSummaries(accountIds: string[]): Promise<ProfileSummary[]> {
    return profiles.filter((profile) => accountIds.includes(profile.accountId));
  }
}
