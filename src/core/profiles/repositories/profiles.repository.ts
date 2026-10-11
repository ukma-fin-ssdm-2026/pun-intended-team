// Written with the help of Claude
import type { NewProfile, Profile, ProfileChanges, ProfileSummary } from '../types/profile.ts';

export abstract class ProfilesRepository {
  abstract findSummaries(accountIds: string[]): Promise<ProfileSummary[]>;

  abstract findByAccountId(accountId: string): Promise<Profile | undefined>;

  /** Usernames are unique regardless of case; `exceptAccountId` lets a user keep their own. */
  abstract isUsernameTaken(username: string, exceptAccountId?: string): Promise<boolean>;

  abstract create(accountId: string, profile: NewProfile): Promise<Profile>;

  abstract update(accountId: string, changes: ProfileChanges): Promise<Profile>;

  /** Replaces the whole set of interests. */
  abstract replaceInterests(accountId: string, interestIds: string[]): Promise<Profile>;
}
