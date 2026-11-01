// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ageOn } from '../../common/age.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import { AccountsService } from '../../identity/services/accounts.service.ts';
import { InterestsRepository } from '../repositories/interests.repository.ts';
import { ProfilesRepository } from '../repositories/profiles.repository.ts';
import type {
  Interest,
  NewProfile,
  Profile,
  ProfileChanges,
  ProfileDetails,
  ProfileSummary,
} from '../types/profile.ts';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly interestsRepository: InterestsRepository,
    private readonly accountsService: AccountsService,
  ) {}

  /** Summaries by account id; accounts without a profile are left out. */
  async getSummaries(accountIds: string[]): Promise<Map<string, ProfileSummary>> {
    const summaries = await this.profilesRepository.findSummaries([...new Set(accountIds)]);
    return new Map(summaries.map((summary) => [summary.accountId, summary]));
  }

  async listInterests(): Promise<Interest[]> {
    return this.interestsRepository.findAll();
  }

  async getOwn(accountId: string): Promise<ProfileDetails> {
    return this.withDetails(await this.requireProfile(accountId));
  }

  /** The first onboarding step: only the username and the display name. */
  async create(accountId: string, input: NewProfile): Promise<ProfileDetails> {
    if (await this.profilesRepository.findByAccountId(accountId)) {
      throw new DomainError('PROFILE_EXISTS', 'The account already has a profile');
    }
    await this.requireFreeUsername(input.username);
    return this.withDetails(await this.profilesRepository.create(accountId, input));
  }

  /** Every later onboarding step and the edit screen; only the fields sent change. */
  async update(accountId: string, changes: ProfileChanges): Promise<ProfileDetails> {
    const profile = await this.requireProfile(accountId);
    // Keeping one's own username (even in another case) is not a clash.
    if (changes.username !== undefined) {
      await this.requireFreeUsername(changes.username, accountId);
    }
    return this.withDetails(await this.profilesRepository.update(profile.accountId, changes));
  }

  async replaceInterests(accountId: string, interestIds: string[]): Promise<ProfileDetails> {
    const profile = await this.requireProfile(accountId);
    const wanted = [...new Set(interestIds)];
    const known = new Set((await this.interestsRepository.findAll()).map((interest) => interest.id));
    if (wanted.some((id) => !known.has(id))) {
      throw new DomainError('REFERENCE_NOT_FOUND', 'Interest not found');
    }
    return this.withDetails(await this.profilesRepository.replaceInterests(profile.accountId, wanted));
  }

  private async requireProfile(accountId: string): Promise<Profile> {
    const profile = await this.profilesRepository.findByAccountId(accountId);
    if (!profile) {
      throw new DomainError('NOT_FOUND', 'Profile not found');
    }
    return profile;
  }

  private async requireFreeUsername(username: string, exceptAccountId?: string): Promise<void> {
    if (await this.profilesRepository.isUsernameTaken(username, exceptAccountId)) {
      throw new DomainError('USERNAME_TAKEN', 'This username is already taken');
    }
  }

  private async withDetails(profile: Profile): Promise<ProfileDetails> {
    const [dateOfBirth, allInterests] = await Promise.all([
      this.accountsService.getDateOfBirth(profile.accountId),
      this.interestsRepository.findAll(),
    ]);
    // An account that has a profile always has a date of birth; a missing one is a data bug, so a 500.
    if (dateOfBirth === undefined) {
      throw new Error(`Profile of ${profile.accountId} has no account date of birth`);
    }
    const chosen = new Set(profile.interestIds);
    const interests = allInterests.filter((interest) => chosen.has(interest.id));
    return {
      username: profile.username,
      displayName: profile.displayName,
      description: profile.description,
      occupation: profile.occupation,
      communicationFormat: profile.communicationFormat,
      sharePhone: profile.sharePhone,
      age: ageOn(kyivDate(), dateOfBirth),
      interests,
      isComplete: profile.communicationFormat !== null && interests.length > 0,
    };
  }
}
