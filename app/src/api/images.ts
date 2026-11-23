// Written with the help of Claude
import { config } from '@/config';
import { toFractions } from '@/pictures/geometry';
import { readPictureBytes, type PictureDraft } from '@/pictures/picked-picture';
import { profileSession, setProfile } from '@/state/profile';

import { apiClient } from './client';
import { call, type ApiResult } from './public-client';
import type { components } from './schema';

type Profile = components['schemas']['Profile'];
type Listing = components['schemas']['Listing'];
type Event = components['schemas']['Event'];
type Organization = components['schemas']['Organization'];
export type ApiImage = NonNullable<Profile['photo']>;
export type ApiCoverImage = NonNullable<Profile['cover']>;
export type ApiEventPhoto = NonNullable<Event['photo']>;
export type ProfileImageSlot = 'photo' | 'cover';

// A picture takes longer than a JSON request on a slow network.
const UPLOAD_TIMEOUT_MS = 90 * 1000;

const profilePaths = { photo: '/api/v1/me/profile/photo', cover: '/api/v1/me/profile/cover' } as const;

export function imageUrl(id: string): string {
  return `${config.apiUrl}/api/v1/images/${id}`;
}

function uploadFetch(request: Request): Promise<Response> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  return fetch(request, { signal: controller.signal });
}

function cropQuery({ picture, crop }: PictureDraft) {
  const { left, top, width, height } = toFractions(crop, picture);
  return { cropLeft: left, cropTop: top, cropWidth: width, cropHeight: height };
}

// The body is the picture's bytes, sent as they are; undefined when the file is gone. Not a Blob: Expo's fetch replaces
// the Content-Type with the Blob's type, which is empty for a file read from the phone.
async function pictureBody({ picture }: PictureDraft) {
  const bytes = await readPictureBytes(picture.uri).catch(() => undefined);
  return (
    bytes && {
      bodySerializer: (body: unknown) => body as BodyInit,
      fetch: uploadFetch,
      body: bytes as unknown as string,
      headers: { 'Content-Type': picture.type },
    }
  );
}

const unreadable = { ok: false, status: 0 } as const;

export async function uploadProfileImage(slot: ProfileImageSlot, draft: PictureDraft): Promise<ApiResult<Profile>> {
  const body = await pictureBody(draft);
  if (!body) return unreadable;
  const from = profileSession();
  const result = await call(() => apiClient.PUT(profilePaths[slot], { ...body, params: { query: cropQuery(draft) } }));
  if (result.ok) setProfile(result.data, from);
  return result;
}

export async function deleteProfileImage(slot: ProfileImageSlot): Promise<ApiResult<Profile>> {
  const from = profileSession();
  const result = await call(() => apiClient.DELETE(profilePaths[slot]));
  if (result.ok) setProfile(result.data, from);
  return result;
}

export async function uploadListingPhoto(id: string, draft: PictureDraft): Promise<ApiResult<Listing>> {
  const body = await pictureBody(draft);
  if (!body) return unreadable;
  return call(() =>
    apiClient.PUT('/api/v1/listings/{id}/photo', {
      ...body,
      params: { path: { id }, query: cropQuery(draft) },
    }),
  );
}

export async function uploadEventPhoto(id: string, draft: PictureDraft): Promise<ApiResult<Event>> {
  const body = await pictureBody(draft);
  if (!body) return unreadable;
  return call(() =>
    apiClient.PUT('/api/v1/events/{id}/photo', { ...body, params: { path: { id }, query: cropQuery(draft) } }),
  );
}

export function deleteEventPhoto(id: string): Promise<ApiResult<Event>> {
  return call(() => apiClient.DELETE('/api/v1/events/{id}/photo', { params: { path: { id } } }));
}

export async function uploadOrganizationLogo(draft: PictureDraft): Promise<ApiResult<Organization>> {
  const body = await pictureBody(draft);
  if (!body) return unreadable;
  return call(() => apiClient.PUT('/api/v1/me/organization/logo', { ...body, params: { query: cropQuery(draft) } }));
}

export function deleteOrganizationLogo(): Promise<ApiResult<Organization>> {
  return call(() => apiClient.DELETE('/api/v1/me/organization/logo'));
}
