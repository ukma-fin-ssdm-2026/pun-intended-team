// Written with the help of Claude
import createClient from 'openapi-fetch';

import { config } from '@/config';

import type { paths } from './schema';

// Sends no token of its own: for the auth endpoints, which need none or get one passed explicitly.
export const publicClient = createClient<paths>({ baseUrl: config.apiUrl });

// status 0: the API could not be reached.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

export async function call<T>(
  request: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<ApiResult<T>> {
  try {
    const { data, error, response } = await request();
    if (response.ok) {
      return { ok: true, data: data as T };
    }
    const code = (error as { error?: { code?: string } } | undefined)?.error?.code;
    return { ok: false, status: response.status, code };
  } catch {
    return { ok: false, status: 0 };
  }
}
