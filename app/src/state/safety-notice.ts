// Written with the help of Claude
import { useEffect } from 'react';

import { deviceStorage } from '@/device-storage';
import { createStore } from '@/state/store';

// The matches whose safety notice this account has seen on this device (FR-032); another device shows it again.
const KEY_PREFIX = 'nearby.safetyNoticeSeen.';
// The keychain warns above 2 KB per value; a notice is seen soon after its match turns mutual, so the latest are enough.
const KEEP = 40;

const store = createStore<{ username?: string; matchIds: string[]; loaded: boolean }>({ matchIds: [], loaded: false });

async function load(username: string) {
  store.set({ username, matchIds: [], loaded: false });
  let matchIds: string[] = [];
  try {
    const stored = JSON.parse((await deviceStorage.get(KEY_PREFIX + username)) ?? '[]');
    if (Array.isArray(stored)) matchIds = stored.filter((id): id is string => typeof id === 'string');
  } catch {
    // Unreadable storage shows the notice again, which is the safe side.
  }
  if (store.get().username === username) store.set({ matchIds, loaded: true });
}

// Keyed by username, so two accounts on one device do not hide the notice from each other.
export function useSafetyNoticeSeen(username: string | undefined, matchId: string) {
  const state = store.use();
  useEffect(() => {
    if (username && state.username !== username) void load(username);
  }, [username, state.username]);
  const loaded = !!username && state.username === username && state.loaded;
  return { loaded, seen: loaded && state.matchIds.includes(matchId) };
}

export async function markSafetyNoticeSeen(username: string, matchId: string) {
  const current = store.get().username === username ? store.get().matchIds : [];
  const matchIds = [matchId, ...current.filter((id) => id !== matchId)].slice(0, KEEP);
  store.set({ username, matchIds, loaded: true });
  try {
    await deviceStorage.set(KEY_PREFIX + username, JSON.stringify(matchIds));
  } catch {
    // Not kept: the notice shows once more next time.
  }
}
