// Written with the help of Claude
import createClient from 'openapi-fetch';

import { config } from '@/config';

import { fetchWithTimeout } from './fetch-with-timeout';
import { RefreshFailedError } from './refresh-failed-error';
import type { paths } from './schema';

// Sends no token of its own: for the auth endpoints, which need none or get one passed explicitly.
export const publicClient = createClient<paths>({ baseUrl: config.apiUrl, fetch: fetchWithTimeout });

// status 0: the API could not be reached, or did not answer in time.
// `fields`: what a 400 points at, e.g. `linkedAccounts.0.username`.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: string; fields?: string[] };

export async function call<T>(
  request: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<ApiResult<T>> {
  try {
    const { data, error, response } = await request();
    if (response.ok) {
      return { ok: true, data: data as T };
    }
    const body = (error as { error?: { code?: string; details?: { field?: string }[] } } | undefined)?.error;
    const fields = body?.details?.flatMap(({ field }) => (field ? [field] : []));
    return { ok: false, status: response.status, code: body?.code, fields };
  } catch (error) {
    return error instanceof RefreshFailedError ? refreshFailure(error) : { ok: false, status: 0 };
  }
}

// The API answered the renewal, so this is not "no connection" (REL-12). Only 429 and 5xx keep their status: screens
// read a 409 or 400 as a conflict or bad input of their own request, so any other answer is reported as 503.
function refreshFailure({ status, code }: RefreshFailedError): Extract<ApiResult<never>, { ok: false }> {
  return status === 429 || status >= 500 ? { ok: false, status, code } : { ok: false, status: 503 };
}
