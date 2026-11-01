// Written with the help of Claude
import { useEffect } from 'react';

import { apiClient } from '@/api/client';
import { profileSession, profileState, setProfile, setProfileState, useProfileState } from '@/state/profile';
import { useSession } from '@/state/session';

let request: { session: number; done: Promise<void> } | undefined;

// One request at a time per session, however many screens ask; a request of an earlier session is not reused.
function loadProfile() {
  const from = profileSession();
  if (request?.session === from) return request.done;
  const done = (async () => {
    setProfileState({ status: 'loading' }, from);
    try {
      const { data, response } = await apiClient.GET('/api/v1/me/profile');
      if (data) setProfile(data, from);
      else setProfileState({ status: response.status === 404 ? 'missing' : 'error' }, from);
    } catch {
      setProfileState({ status: 'error' }, from);
    }
  })().finally(() => {
    if (request?.done === done) request = undefined;
  });
  request = { session: from, done };
  return done;
}

// The first letter of the display name, for the avatars that have no photo.
export function useProfileInitial() {
  return useProfile().data?.displayName.charAt(0).toUpperCase() ?? '';
}

// The signed-in account's profile, shared by every screen; loaded on first use and kept up to date by the saves in
// api/profile.ts.
export function useProfile() {
  const state = useProfileState();
  // A guest has no profile, and its token gets a 401 here.
  const { signedIn, isGuest } = useSession();
  const enabled = signedIn && !isGuest;

  useEffect(() => {
    if (enabled && profileState().status === 'idle') void loadProfile();
  }, [enabled, state.status]);

  return {
    data: state.profile,
    missing: state.status === 'missing',
    loading: state.status === 'idle' || state.status === 'loading',
    error: state.status === 'error',
    reload: () => void loadProfile(),
  };
}
