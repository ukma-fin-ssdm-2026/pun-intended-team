// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { ProfilesService } from '../../../core/profiles/services/profiles.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import {
  CreateProfileBody,
  InterestList,
  Profile,
  ReplaceInterestsBody,
  ReplaceLinkedAccountsBody,
  UpdateProfileBody,
} from '../schemas/profiles.ts';

const CreateProfileRequest = { body: CreateProfileBody } satisfies RequestSchemas;
const UpdateProfileRequest = { body: UpdateProfileBody } satisfies RequestSchemas;
const ReplaceInterestsRequest = { body: ReplaceInterestsBody } satisfies RequestSchemas;
const ReplaceLinkedAccountsRequest = { body: ReplaceLinkedAccountsBody } satisfies RequestSchemas;

const NO_PROFILE = {
  description: 'The account has not created a profile yet',
  schema: ErrorResponse,
};

@Controller()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.interests.list,
    operationId: 'listInterests',
    summary: 'List the interests users can pick',
    description:
      'List the fixed set of interests users can pick for their profile, by group and then by name; their ids go in interestIds.',
    tags: ['Interests'],
    access: 'user',
    responses: {
      200: { description: 'All interests', schema: InterestList },
    },
  })
  async listInterests(): Promise<InterestList> {
    return { items: await this.profilesService.listInterests() };
  }

  @Endpoint({
    method: 'get',
    path: Routes.profiles.me,
    operationId: 'getMyProfile',
    summary: 'Get your profile',
    description:
      'Get the caller’s own profile with the age computed from the account’s date of birth. ' +
      '`isComplete` is true once a communication format, at least one interest and at least one linked account are set.',
    tags: ['Profiles'],
    access: 'user',
    responses: {
      200: { description: 'The profile', schema: Profile },
      404: NO_PROFILE,
    },
  })
  async getMyProfile(@CurrentAccount() account: AccountCaller): Promise<Profile> {
    return this.profilesService.getOwn(account.accountId);
  }

  @Endpoint({
    method: 'post',
    path: Routes.profiles.me,
    operationId: 'createMyProfile',
    summary: 'Start your profile',
    description:
      'First onboarding step: create the caller’s profile with a username and a display name. ' +
      'Every later step is `updateMyProfile` and `replaceMyInterests`.',
    tags: ['Profiles'],
    access: 'user',
    request: CreateProfileRequest,
    responses: {
      201: { description: 'The new profile', schema: Profile },
      409: {
        description:
          '`USERNAME_TAKEN`: another user has this username. `PROFILE_EXISTS`: the account already has a profile.',
        schema: ErrorResponse,
      },
    },
    location: Routes.profiles.me,
  })
  async createMyProfile(
    @Input() { body }: RouteInput<typeof CreateProfileRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Profile> {
    return this.profilesService.create(account.accountId, body);
  }

  @Endpoint({
    method: 'patch',
    path: Routes.profiles.me,
    operationId: 'updateMyProfile',
    summary: 'Edit your profile',
    description:
      'Change the caller’s profile: any of displayName, username, description, occupation, communicationFormat and sharePhone; ' +
      'only the fields sent change. Used for every later onboarding step and for the edit screen.',
    tags: ['Profiles'],
    access: 'user',
    request: UpdateProfileRequest,
    responses: {
      200: { description: 'The updated profile', schema: Profile },
      404: NO_PROFILE,
      409: { description: '`USERNAME_TAKEN`: another user has this username.', schema: ErrorResponse },
    },
  })
  async updateMyProfile(
    @Input() { body }: RouteInput<typeof UpdateProfileRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Profile> {
    return this.profilesService.update(account.accountId, body);
  }

  @Endpoint({
    method: 'put',
    path: Routes.profiles.interests,
    operationId: 'replaceMyInterests',
    summary: 'Set your interests',
    description: 'Replace the whole set of the caller’s interests with the given ids; an empty list clears it.',
    tags: ['Profiles'],
    access: 'user',
    request: ReplaceInterestsRequest,
    responses: {
      200: { description: 'The updated profile', schema: Profile },
      404: NO_PROFILE,
      422: { description: '`REFERENCE_NOT_FOUND`: one of the interest ids does not exist.', schema: ErrorResponse },
    },
  })
  async replaceMyInterests(
    @Input() { body }: RouteInput<typeof ReplaceInterestsRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Profile> {
    return this.profilesService.replaceInterests(account.accountId, body.interestIds);
  }

  @Endpoint({
    method: 'put',
    path: Routes.profiles.linkedAccounts,
    operationId: 'replaceMyLinkedAccounts',
    summary: 'Set your networks',
    description:
      'Replace the whole set of networks (Telegram, Instagram, …) a mutual match sees, at most one per app. ' +
      'At least one is required, since sign-in is Google-only and there is no phone number to share.',
    tags: ['Profiles'],
    access: 'user',
    request: ReplaceLinkedAccountsRequest,
    responses: {
      200: { description: 'The updated profile', schema: Profile },
      404: NO_PROFILE,
      422: {
        description:
          '`CONTACT_REQUIRED`: the list is empty. `INVALID_SOCIAL_HANDLE`: a username does not fit its social network; `details` names it.',
        schema: ErrorResponse,
      },
    },
  })
  async replaceMyLinkedAccounts(
    @Input() { body }: RouteInput<typeof ReplaceLinkedAccountsRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Profile> {
    return this.profilesService.replaceLinkedAccounts(account.accountId, body.linkedAccounts);
  }
}
