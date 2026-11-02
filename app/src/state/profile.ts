// Written with the help of Claude
import type { components } from '@/api/schema';
import { createStore } from '@/state/store';

type Profile = components['schemas']['Profile'];

// `missing`: the account has no profile yet (404), so it has not finished В7.
export type ProfileState =
  { status: 'idle' | 'loading' | 'missing' | 'error'; profile?: undefined } | { status: 'loaded'; profile: Profile };

const store = createStore<{ state: ProfileState }>({ state: { status: 'idle' } });

// Counts sign-ins and sign-outs. A load or save that started in an earlier session is dropped when it finishes, so it
// never shows one account's profile to the next.
let session = 0;

export const profileSession = () => session;

export const useProfileState = () => store.use().state;
export const profileState = () => store.get().state;

export function setProfileState(state: ProfileState, from = session) {
  if (from === session) store.set({ state });
}

export function setProfile(profile: Profile, from = session) {
  setProfileState({ status: 'loaded', profile }, from);
}

// On sign-in and sign-out, so the next account never sees the previous one's profile.
export function clearProfile() {
  session += 1;
  store.set({ state: { status: 'idle' } });
}
