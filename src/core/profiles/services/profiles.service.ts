// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ageOn } from '../../common/age.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import type { Transaction } from '../../common/transaction.ts';
import { AccountsService } from '../../identity/services/accounts.service.ts';
import { InterestsRepository } from '../repositories/interests.repository.ts';
import { ProfilesRepository } from '../repositories/profiles.repository.ts';
import { socialNetworkHandle, socialNetworkHint, socialNetworkUrl } from './social-networks.ts';
import type {
  Contacts,
  Interest,
  LinkedAccount,
  LinkedAccountDetails,
  NewProfile,
  Profile,
  ProfileChanges,
  ProfileDetails,
  ProfileSummary,
  PublicProfile,
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

  /** The account with this username, in any case; undefined when no profile has it. */
  async findAccountId(username: string): Promise<string | undefined> {
    return this.profilesRepository.findAccountIdByUsername(username);
  }

  async listInterests(): Promise<Interest[]> {
    return this.interestsRepository.findAll();
  }

  /** Whether the profile has what matching needs (use case E1); false without a profile. */
  async isComplete(accountId: string): Promise<boolean> {
    const profile = await this.profilesRepository.findByAccountId(accountId);
    return profile !== undefined && isComplete(profile);
  }

  /** The interests of each account, for scoring a pair; accounts without a profile are left out. */
  async getInterests(accountIds: string[], tx?: Transaction): Promise<Map<string, Interest[]>> {
    const [profiles, interestsOf] = await Promise.all([
      this.profilesRepository.findByAccountIds([...new Set(accountIds)], tx),
      this.interestsLookup(tx),
    ]);
    return new Map(profiles.map((profile) => [profile.accountId, interestsOf(profile)]));
  }

  /** What a proposed match sees of each account; accounts without a profile are left out. */
  async getPublicProfiles(accountIds: string[]): Promise<Map<string, PublicProfile>> {
    const ids = [...new Set(accountIds)];
    const [profiles, interestsOf, datesOfBirth] = await Promise.all([
      this.profilesRepository.findByAccountIds(ids),
      this.interestsLookup(),
      this.accountsService.getDatesOfBirth(ids),
    ]);
    return new Map(
      profiles.map((profile) => [
        profile.accountId,
        {
          accountId: profile.accountId,
          username: profile.username,
          displayName: profile.displayName,
          description: profile.description,
          occupation: profile.occupation,
          age: ageFrom(profile.accountId, datesOfBirth.get(profile.accountId)),
          interests: interestsOf(profile),
        },
      ]),
    );
  }

  /** What a mutual match sees: the linked networks, and the phone number if the user shares it (FR-019). */
  async getContacts(accountId: string): Promise<Contacts> {
    const profile = await this.requireProfile(accountId);
    return {
      phone: profile.sharePhone ? await this.accountsService.getPhone(accountId) : null,
      linkedAccounts: profile.linkedAccounts.map(withUrl),
    };
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

  /**
   * `linkedAccounts` holds what the user typed: a nickname or a profile link, kept as the bare handle. A mutual match
   * needs a contact to reveal, and sign-in is Google-only, so there is no phone: one social network at least.
   */
  async replaceLinkedAccounts(accountId: string, linkedAccounts: LinkedAccount[]): Promise<ProfileDetails> {
    const profile = await this.requireProfile(accountId);
    if (linkedAccounts.length === 0) {
      throw new DomainError('CONTACT_REQUIRED', 'Keep at least one social network to share with a match');
    }
    const handles = linkedAccounts.map(({ network, username }, index) => {
      const handle = socialNetworkHandle(network, username);
      if (handle === undefined) {
        throw new DomainError(
          'INVALID_SOCIAL_HANDLE',
          `Expected ${socialNetworkHint(network)}`,
          `linkedAccounts.${index}.username`,
        );
      }
      return { network, username: handle };
    });
    return this.withDetails(await this.profilesRepository.replaceLinkedAccounts(profile.accountId, handles));
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
    const [age, interestsOf] = await Promise.all([this.ageOf(profile.accountId), this.interestsLookup()]);
    return {
      username: profile.username,
      displayName: profile.displayName,
      description: profile.description,
      occupation: profile.occupation,
      communicationFormat: profile.communicationFormat,
      sharePhone: profile.sharePhone,
      age,
      interests: interestsOf(profile),
      linkedAccounts: profile.linkedAccounts.map(withUrl),
      isComplete: isComplete(profile),
    };
  }

  private async ageOf(accountId: string): Promise<number> {
    return ageFrom(accountId, await this.accountsService.getDateOfBirth(accountId));
  }

  /** The chosen interests of a profile, in the order of the list. */
  private async interestsLookup(tx?: Transaction): Promise<(profile: Profile) => Interest[]> {
    const allInterests = await this.interestsRepository.findAll(tx);
    return (profile) => {
      const chosen = new Set(profile.interestIds);
      return allInterests.filter((interest) => chosen.has(interest.id));
    };
  }
}

function ageFrom(accountId: string, dateOfBirth: string | undefined): number {
  // An account that has a profile always has a date of birth; a missing one is a data bug, so a 500.
  if (dateOfBirth === undefined) {
    throw new Error(`Profile of ${accountId} has no account date of birth`);
  }
  return ageOn(kyivDate(), dateOfBirth);
}

function withUrl({ network, username }: LinkedAccount): LinkedAccountDetails {
  return { network, username, url: socialNetworkUrl(network, username) };
}

/** A communication format, at least one interest and at least one linked network. */
function isComplete(profile: Profile): boolean {
  return profile.communicationFormat !== null && profile.interestIds.length > 0 && profile.linkedAccounts.length > 0;
}
