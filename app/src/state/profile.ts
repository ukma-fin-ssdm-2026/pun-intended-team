// Written with the help of Claude
import type { components } from '@/api/schema';
import { createStore } from '@/state/store';

type Profile = components['schemas']['Profile'];

// `missing`: the account has no profile yet (404), so it has not finished В7.
export type ProfileState =
  { status: 'idle' | 'loading' | 'missing' | 'error'; profile?: undefined } | { status: 'loaded'; profile: Profile };

const store = createStore<{ state: ProfileState }>({ state: { status: 'idle' } });

export const useProfileState = () => store.use().state;
export const profileState = () => store.get().state;

export function setProfileState(state: ProfileState) {
  store.set({ state });
}

export function setProfile(profile: Profile) {
  store.set({ state: { status: 'loaded', profile } });
}

// On sign-in and sign-out, so the next account never sees the previous one's profile.
export function clearProfile() {
  store.set({ state: { status: 'idle' } });
}
