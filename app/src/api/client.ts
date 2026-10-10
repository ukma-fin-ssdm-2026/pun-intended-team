// Written with the help of Claude
import createClient, { type Middleware } from 'openapi-fetch';

import { config } from '@/config';

import type { paths } from './schema';

// Renewed this long before it expires, so a request never carries a token that runs out on the way.
const RENEW_BEFORE_MS = 60 * 1000;

type GuestToken = { value: string; expiresAt: number };

let guestToken: Promise<GuestToken> | undefined;

// Without the middleware below, so getting a token does not need a token.
const authClient = createClient<paths>({ baseUrl: config.apiUrl });

function currentGuestToken(): Promise<GuestToken> {
  guestToken ??= authClient.POST('/api/v1/auth/guest').then(({ data }) => {
    if (!data) {
      throw new Error('Could not get a guest token');
    }
    return { value: data.accessToken, expiresAt: Date.now() + data.expiresIn * 1000 };
  });
  // A failed request is not cached, so the next call tries again.
  guestToken.catch(() => {
    guestToken = undefined;
  });
  return guestToken;
}

const guestAuth: Middleware = {
  async onRequest({ request }) {
    let token = await currentGuestToken();
    if (token.expiresAt - Date.now() < RENEW_BEFORE_MS) {
      guestToken = undefined;
      token = await currentGuestToken();
    }
    request.headers.set('Authorization', `Bearer ${token.value}`);
    return request;
  },
  // E.g. the API restarted with new keys: the next request gets a fresh token.
  onResponse({ response }) {
    if (response.status === 401) {
      guestToken = undefined;
    }
  },
};

export const apiClient = createClient<paths>({ baseUrl: config.apiUrl });
apiClient.use(guestAuth);
