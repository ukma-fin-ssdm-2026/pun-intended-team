// Written with the help of Claude
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { setSignedIn } from '@/state/session';

import { publicClient } from './public-client';
import type { components } from './schema';

type SessionTokens = components['schemas']['SessionTokensResponse'];
type Token = { value: string; expiresAt: number };

// Renewed this long before it expires, so a request never carries a token that runs out on the way.
const RENEW_BEFORE_MS = 60 * 1000;
const REFRESH_TOKEN_KEY = 'nearby.refreshToken';

// The keychain or keystore on a phone; on the web, localStorage. Static web rendering has neither.
const storage =
  Platform.OS === 'web'
    ? {
        get: async (key: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
        set: async (key: string, value: string) => localStorage.setItem(key, value),
        remove: async (key: string) => localStorage.removeItem(key),
      }
    : { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync, remove: SecureStore.deleteItemAsync };

let account: { access: Token; refreshToken: string } | undefined;
let renewal: Promise<void> | undefined;
let guestToken: Promise<Token> | undefined;

function toToken(accessToken: string, expiresIn: number): Token {
  return { value: accessToken, expiresAt: Date.now() + expiresIn * 1000 };
}

export async function startSession(tokens: SessionTokens) {
  account = { access: toToken(tokens.accessToken, tokens.expiresIn), refreshToken: tokens.refreshToken };
  await storage.set(REFRESH_TOKEN_KEY, tokens.refreshToken);
  setSignedIn(true);
}

async function endSession() {
  account = undefined;
  await storage.remove(REFRESH_TOKEN_KEY).catch(() => undefined);
  setSignedIn(false);
}

// Signed out locally even when the API cannot be reached; the session then expires on its own.
export async function signOut() {
  const token = account?.access.value;
  if (token) {
    await publicClient
      .POST('/api/v1/auth/sign-out', { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => undefined);
  }
  await endSession();
}

// On launch a stored refresh token counts as signed in and is renewed in the background, so a session that ended
// elsewhere signs out at once; offline, the first request renews it.
export async function restoreSession() {
  const refreshToken = await storage.get(REFRESH_TOKEN_KEY).catch(() => null);
  if (!refreshToken) {
    setSignedIn(false);
    return;
  }
  account = { access: { value: '', expiresAt: 0 }, refreshToken };
  setSignedIn(true);
  renew(refreshToken).catch(() => undefined);
}

// One renewal at a time: the API ends the session when a replaced refresh token is used again.
function renew(refreshToken: string): Promise<void> {
  renewal ??= publicClient
    .POST('/api/v1/auth/refresh', { body: { refreshToken } })
    .then(async ({ data, response }) => {
      if (data) {
        await startSession(data);
      } else if (response.status === 401) {
        await endSession();
      } else {
        throw new Error('Could not renew the session');
      }
    })
    .finally(() => {
      renewal = undefined;
    });
  return renewal;
}

function currentGuestToken(): Promise<Token> {
  guestToken ??= publicClient.POST('/api/v1/auth/guest').then(({ data }) => {
    if (!data) {
      throw new Error('Could not get a guest token');
    }
    return toToken(data.accessToken, data.expiresIn);
  });
  // A failed request is not cached, so the next call tries again.
  guestToken.catch(() => {
    guestToken = undefined;
  });
  return guestToken;
}

// The account's access token when signed in, a guest token otherwise.
export async function currentAccessToken(): Promise<string> {
  if (account && account.access.expiresAt - Date.now() < RENEW_BEFORE_MS) {
    await renew(account.refreshToken);
  }
  if (account) {
    return account.access.value;
  }
  let token = await currentGuestToken();
  if (token.expiresAt - Date.now() < RENEW_BEFORE_MS) {
    guestToken = undefined;
    token = await currentGuestToken();
  }
  return token.value;
}

// E.g. the session was ended elsewhere or the API restarted with new keys: the next request renews or gets a new
// guest token, and a session that is gone signs out.
export function rejectAccessToken(token: string) {
  if (account?.access.value === token) {
    account.access.expiresAt = 0;
  } else {
    guestToken = undefined;
  }
}
