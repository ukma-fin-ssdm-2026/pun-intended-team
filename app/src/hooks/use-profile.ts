// Written with the help of Claude
import { useEffect } from 'react';

import { apiClient } from '@/api/client';
import { profileState, setProfile, setProfileState, useProfileState } from '@/state/profile';
import { useSession } from '@/state/session';

let request: Promise<void> | undefined;

// One request at a time, however many screens ask.
function loadProfile() {
  request ??= (async () => {
    setProfileState({ status: 'loading' });
    try {
      const { data, response } = await apiClient.GET('/api/v1/me/profile');
      // Signed out meanwhile.
      if (profileState().status !== 'loading') return;
      if (data) setProfile(data);
      else setProfileState({ status: response.status === 404 ? 'missing' : 'error' });
    } catch {
      setProfileState({ status: 'error' });
    }
  })().finally(() => {
    request = undefined;
  });
  return request;
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
