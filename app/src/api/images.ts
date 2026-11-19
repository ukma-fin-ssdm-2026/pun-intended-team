// Written with the help of Claude
import { config } from '@/config';
import { toFractions } from '@/pictures/geometry';
import type { PictureDraft } from '@/pictures/picked-picture';
import { profileSession, setProfile } from '@/state/profile';

import { apiClient } from './client';
import { call, type ApiResult } from './public-client';
import type { components } from './schema';

type Profile = components['schemas']['Profile'];
type Listing = components['schemas']['Listing'];
export type ApiImage = NonNullable<Profile['photo']>;
export type ApiCoverImage = NonNullable<Profile['cover']>;
export type ProfileImageSlot = 'photo' | 'cover';

// The API's limit; a larger picture is refused before it is sent.
export const MAX_PICTURE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
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

/** The picture's bytes and type, or a failure the screen can name. */
async function readPicture({ picture }: PictureDraft): Promise<{ body: Blob; type: string } | ApiResult<never>> {
  try {
    const body = await (await fetch(picture.uri)).blob();
    const type = [picture.mimeType, body.type].find((candidate) => candidate && ACCEPTED_TYPES.includes(candidate));
    if (!type) return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' };
    if (body.size > MAX_PICTURE_BYTES) return { ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' };
    return { body, type };
  } catch {
    return { ok: false, status: 0 };
  }
}

function cropQuery({ picture, crop }: PictureDraft) {
  const { left, top, width, height } = toFractions(crop, picture);
  return { cropLeft: left, cropTop: top, cropWidth: width, cropHeight: height };
}

// The body is the picture itself, so openapi-fetch must send it as it is.
const asIs = { bodySerializer: (body: unknown) => body as BodyInit, fetch: uploadFetch };

export async function uploadProfileImage(slot: ProfileImageSlot, draft: PictureDraft): Promise<ApiResult<Profile>> {
  const read = await readPicture(draft);
  if ('ok' in read) return read;
  const from = profileSession();
  const result = await call(() =>
    apiClient.PUT(profilePaths[slot], {
      ...asIs,
      params: { query: cropQuery(draft) },
      body: read.body as unknown as string,
      headers: { 'Content-Type': read.type },
    }),
  );
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
  const read = await readPicture(draft);
  if ('ok' in read) return read;
  return call(() =>
    apiClient.PUT('/api/v1/listings/{id}/photo', {
      ...asIs,
      params: { path: { id }, query: cropQuery(draft) },
      body: read.body as unknown as string,
      headers: { 'Content-Type': read.type },
    }),
  );
}
