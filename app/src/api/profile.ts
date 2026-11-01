// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

type CreateProfileBody = components['schemas']['CreateProfileBody'];
type UpdateProfileBody = components['schemas']['UpdateProfileBody'];

export function createProfile(body: CreateProfileBody) {
  return call(() => apiClient.POST('/api/v1/me/profile', { body }));
}

export function updateProfile(body: UpdateProfileBody) {
  return call(() => apiClient.PATCH('/api/v1/me/profile', { body }));
}

export function replaceInterests(interestIds: string[]) {
  return call(() => apiClient.PUT('/api/v1/me/profile/interests', { body: { interestIds } }));
}
