// Written with the help of Claude
import type { ProfileSummary } from '../types/profile.js';

export abstract class ProfilesRepository {
  abstract findSummaries(accountIds: string[]): Promise<ProfileSummary[]>;
}
