// Written with the help of Claude
import { setProfile } from '@/state/profile';

import { apiClient } from './client';
import { call, type ApiResult } from './public-client';
import type { components } from './schema';

type Profile = components['schemas']['Profile'];
type CreateProfileBody = components['schemas']['CreateProfileBody'];
type UpdateProfileBody = components['schemas']['UpdateProfileBody'];
type NewLinkedAccount = components['schemas']['ReplaceLinkedAccountsBody']['linkedAccounts'][number];

async function saved(result: Promise<ApiResult<Profile>>) {
  const outcome = await result;
  if (outcome.ok) setProfile(outcome.data);
  return outcome;
}

export function createProfile(body: CreateProfileBody) {
  return saved(call(() => apiClient.POST('/api/v1/me/profile', { body })));
}

export function updateProfile(body: UpdateProfileBody) {
  return saved(call(() => apiClient.PATCH('/api/v1/me/profile', { body })));
}

export function replaceInterests(interestIds: string[]) {
  return saved(call(() => apiClient.PUT('/api/v1/me/profile/interests', { body: { interestIds } })));
}

export function replaceLinkedAccounts(linkedAccounts: NewLinkedAccount[]) {
  return saved(call(() => apiClient.PUT('/api/v1/me/profile/linked-accounts', { body: { linkedAccounts } })));
}
