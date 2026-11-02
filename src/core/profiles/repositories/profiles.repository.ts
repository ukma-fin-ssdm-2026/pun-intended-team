// Written with the help of Claude
import type { LinkedAccount, NewProfile, Profile, ProfileChanges, ProfileSummary } from '../types/profile.ts';

export abstract class ProfilesRepository {
  abstract findSummaries(accountIds: string[]): Promise<ProfileSummary[]>;

  abstract findByAccountId(accountId: string): Promise<Profile | undefined>;

  /** Case-insensitive, like the unique index. */
  abstract findAccountIdByUsername(username: string): Promise<string | undefined>;

  /** Usernames are unique regardless of case; `exceptAccountId` lets a user keep their own. */
  abstract isUsernameTaken(username: string, exceptAccountId?: string): Promise<boolean>;

  abstract create(accountId: string, profile: NewProfile): Promise<Profile>;

  abstract update(accountId: string, changes: ProfileChanges): Promise<Profile>;

  /** Replaces the whole set of interests. */
  abstract replaceInterests(accountId: string, interestIds: string[]): Promise<Profile>;

  /** Replaces the whole set of linked networks; at most one per app. */
  abstract replaceLinkedAccounts(accountId: string, linkedAccounts: LinkedAccount[]): Promise<Profile>;
}
