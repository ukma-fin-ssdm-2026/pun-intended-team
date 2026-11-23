// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ageOn } from '../../common/age.ts';
import { DomainError } from '../../common/domain-error.ts';
import { kyivDate } from '../../common/kyiv-time.ts';
import type { Transaction } from '../../common/transaction.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { AccountsService } from '../../identity/services/accounts.service.ts';
import { ImagesService } from '../../images/services/images.service.ts';
import type { ImageUpload } from '../../images/types/image.ts';
import { InterestsRepository } from '../repositories/interests.repository.ts';
import { ProfilesRepository } from '../repositories/profiles.repository.ts';
import { socialNetworkHandle, socialNetworkHint, socialNetworkUrl } from './social-networks.ts';
import type {
  Contacts,
  Interest,
  LinkedAccount,
  LinkedAccountDetails,
  MatchingTraits,
  NewProfile,
  Profile,
  ProfileChanges,
  ProfileDetails,
  ProfileImages,
  ProfileImageSlot,
  ProfileSummary,
  PublicProfile,
} from '../types/profile.ts';

const imageKindOf = { photo: 'profilePhoto', cover: 'profileCover' } as const;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly interestsRepository: InterestsRepository,
    private readonly accountsService: AccountsService,
    private readonly imagesService: ImagesService,
    private readonly transactions: TransactionRunner,
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

  /** Accounts whose username or display name contains the text, in any case; at most `limit` of them. */
  async searchAccountIds(text: string, limit: number): Promise<string[]> {
    return this.profilesRepository.findAccountIdsMatching(text, limit);
  }

  async listInterests(): Promise<Interest[]> {
    return this.interestsRepository.findAll();
  }

  /** Whether the profile has what matching needs (use case E1); false without a profile. */
  async isComplete(accountId: string): Promise<boolean> {
    const profile = await this.profilesRepository.findByAccountId(accountId);
    return profile !== undefined && isComplete(profile);
  }

  /**
   * What matching needs of each account in a pool: the interests to score a pair, the gender and the age on `day`
   * (YYYY-MM-DD in Kyiv) to filter on. Accounts without a profile are left out.
   */
  async getMatchingTraits(accountIds: string[], day: string, tx?: Transaction): Promise<Map<string, MatchingTraits>> {
    const ids = [...new Set(accountIds)];
    const [profiles, interestsOf, datesOfBirth] = await Promise.all([
      this.profilesRepository.findByAccountIds(ids, tx),
      this.interestsLookup(tx),
      this.accountsService.getDatesOfBirth(ids, tx),
    ]);
    return new Map(
      profiles.map((profile) => [
        profile.accountId,
        {
          interests: interestsOf(profile),
          gender: profile.gender,
          age: ageFrom(profile.accountId, datesOfBirth.get(profile.accountId), day),
        },
      ]),
    );
  }

  /** What a proposed match sees of each account; accounts without a profile are left out. */
  async getPublicProfiles(accountIds: string[]): Promise<Map<string, PublicProfile>> {
    const ids = [...new Set(accountIds)];
    const profiles = await this.profilesRepository.findByAccountIds(ids);
    const [interestsOf, datesOfBirth, imagesOf] = await Promise.all([
      this.interestsLookup(),
      this.accountsService.getDatesOfBirth(ids),
      this.imagesLookup(profiles),
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
          ...imagesOf(profile),
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

  /** Whether the user has acknowledged the safety notice, which contacts wait for (SAFE-002); false without a profile. */
  async hasAcknowledgedSafetyNotice(accountId: string): Promise<boolean> {
    const profile = await this.profilesRepository.findByAccountId(accountId);
    return profile !== undefined && profile.safetyNotice !== 'not_acknowledged';
  }

  /** Records that the user read the safety notice (FR-032), and whether the app shows it on their next matches. */
  async acknowledgeSafetyNotice(accountId: string, dontShowAgain: boolean): Promise<ProfileDetails> {
    const profile = await this.requireProfile(accountId);
    return this.withDetails(await this.profilesRepository.acknowledgeSafetyNotice(profile.accountId, dontShowAgain));
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

  /**
   * Every later onboarding step and the edit screen; only the fields sent change. A gender of "other" needs the user's
   * description of it, and any other gender drops the description.
   */
  async update(accountId: string, changes: ProfileChanges): Promise<ProfileDetails> {
    const profile = await this.requireProfile(accountId);
    // Keeping one's own username (even in another case) is not a clash.
    if (changes.username !== undefined) {
      await this.requireFreeUsername(changes.username, accountId);
    }
    return this.withDetails(await this.profilesRepository.update(profile.accountId, withGender(changes)));
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

  /** Replaces the avatar or the cover with an uploaded picture, cropped to the shape the slot needs. */
  async setImage(accountId: string, slot: ProfileImageSlot, upload: ImageUpload): Promise<ProfileDetails> {
    const profile = await this.requireProfile(accountId);
    const prepared = await this.imagesService.prepare(imageKindOf[slot], upload);
    const updated = await this.transactions.run(async (tx) => {
      const image = await this.imagesService.save(accountId, prepared, tx);
      const changed = await this.profilesRepository.setImage(accountId, slot, image.id, tx);
      await this.imagesService.remove([imageIdOf(profile, slot)], tx);
      return changed;
    });
    return this.withDetails(updated);
  }

  /** Back to the initial or the default gradient; nothing to remove is not an error. */
  async removeImage(accountId: string, slot: ProfileImageSlot): Promise<ProfileDetails> {
    const profile = await this.requireProfile(accountId);
    const previous = imageIdOf(profile, slot);
    if (previous === null) {
      return this.withDetails(profile);
    }
    const updated = await this.transactions.run(async (tx) => {
      const changed = await this.profilesRepository.setImage(accountId, slot, null, tx);
      await this.imagesService.remove([previous], tx);
      return changed;
    });
    return this.withDetails(updated);
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
    const [age, interestsOf, imagesOf] = await Promise.all([
      this.ageOf(profile.accountId),
      this.interestsLookup(),
      this.imagesLookup([profile]),
    ]);
    return {
      username: profile.username,
      displayName: profile.displayName,
      description: profile.description,
      occupation: profile.occupation,
      communicationFormat: profile.communicationFormat,
      gender: profile.gender,
      genderDescription: profile.genderDescription,
      sharePhone: profile.sharePhone,
      age,
      interests: interestsOf(profile),
      linkedAccounts: profile.linkedAccounts.map(withUrl),
      isComplete: isComplete(profile),
      safetyNotice: profile.safetyNotice,
      ...imagesOf(profile),
    };
  }

  private async ageOf(accountId: string): Promise<number> {
    return ageFrom(accountId, await this.accountsService.getDateOfBirth(accountId));
  }

  private async imagesLookup(profiles: Profile[]): Promise<(profile: Profile) => ProfileImages> {
    const refs = await this.imagesService.getRefs(profiles.flatMap((profile) => [profile.photoId, profile.coverId]));
    return (profile) => {
      const cover = profile.coverId === null ? undefined : refs.get(profile.coverId);
      return {
        photo: (profile.photoId !== null && refs.get(profile.photoId)) || null,
        cover: cover?.crop ? { ...cover, crop: cover.crop } : null,
      };
    };
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

function ageFrom(accountId: string, dateOfBirth: string | undefined, day = kyivDate()): number {
  // An account that has a profile always has a date of birth; a missing one is a data bug, so a 500.
  if (dateOfBirth === undefined) {
    throw new Error(`Profile of ${accountId} has no account date of birth`);
  }
  return ageOn(day, dateOfBirth);
}

/**
 * A gender is saved with its description: the user's words for "other", which the API requires with it, and none for
 * any other gender.
 */
function withGender(changes: ProfileChanges): ProfileChanges {
  if (changes.gender === undefined) {
    return changes;
  }
  return { ...changes, genderDescription: changes.gender === 'other' ? changes.genderDescription : undefined };
}

function imageIdOf(profile: Profile, slot: ProfileImageSlot): string | null {
  return slot === 'photo' ? profile.photoId : profile.coverId;
}

function withUrl({ network, username }: LinkedAccount): LinkedAccountDetails {
  return { network, username, url: socialNetworkUrl(network, username) };
}

/** A communication format, a gender, at least one interest and at least one linked network. */
function isComplete(profile: Profile): boolean {
  return (
    profile.communicationFormat !== null &&
    profile.gender !== null &&
    profile.interestIds.length > 0 &&
    profile.linkedAccounts.length > 0
  );
}
