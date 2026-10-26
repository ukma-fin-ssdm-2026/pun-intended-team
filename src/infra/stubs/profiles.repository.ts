// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ProfilesRepository } from '../../core/profiles/repositories/profiles.repository.ts';
import type { NewProfile, Profile, ProfileChanges, ProfileSummary } from '../../core/profiles/types/profile.ts';
import { profiles } from './data.ts';

@Injectable()
export class StubProfilesRepository implements ProfilesRepository {
  async findSummaries(accountIds: string[]): Promise<ProfileSummary[]> {
    return profiles
      .filter((profile) => accountIds.includes(profile.accountId))
      .map(({ accountId, username, displayName }) => ({ accountId, username, displayName }));
  }

  async findByAccountId(accountId: string): Promise<Profile | undefined> {
    const profile = find(accountId);
    return profile && copy(profile);
  }

  // Stands in for the unique index on lower(username).
  async isUsernameTaken(username: string, exceptAccountId?: string): Promise<boolean> {
    return profiles.some(
      (profile) => profile.accountId !== exceptAccountId && profile.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async create(accountId: string, input: NewProfile): Promise<Profile> {
    const profile: Profile = {
      accountId,
      ...input,
      description: '',
      communicationFormat: null,
      sharePhone: true,
      interestIds: [],
    };
    profiles.push(profile);
    return copy(profile);
  }

  async update(accountId: string, changes: ProfileChanges): Promise<Profile> {
    return copy(Object.assign(required(accountId), changes));
  }

  async replaceInterests(accountId: string, interestIds: string[]): Promise<Profile> {
    const profile = required(accountId);
    profile.interestIds = [...interestIds];
    return copy(profile);
  }
}

function find(accountId: string): Profile | undefined {
  return profiles.find((profile) => profile.accountId === accountId);
}

function required(accountId: string): Profile {
  const profile = find(accountId);
  if (!profile) {
    throw new Error(`No profile of ${accountId} to change`);
  }
  return profile;
}

function copy(profile: Profile): Profile {
  return { ...profile, interestIds: [...profile.interestIds] };
}
