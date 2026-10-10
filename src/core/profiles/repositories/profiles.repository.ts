// Written with the help of Claude
import type { ProfileSummary } from '../types/profile.ts';

export abstract class ProfilesRepository {
  abstract findSummaries(accountIds: string[]): Promise<ProfileSummary[]>;
}
