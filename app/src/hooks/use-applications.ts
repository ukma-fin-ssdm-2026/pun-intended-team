// Written with the help of Claude
import { useEffect } from 'react';

import { loadMyApplications } from '@/api/applications';
import { applicationsState, useApplicationsState } from '@/state/applications';
import { useSession } from '@/state/session';

// The signed-in account's active applications, shared by every screen; loaded on first use and kept up to date by the
// applies and withdrawals in api/applications.ts.
export function useMyApplications() {
  const state = useApplicationsState();
  // A guest has no applications, and its token gets a 401 here.
  const { signedIn, isGuest } = useSession();
  const enabled = signedIn && !isGuest;

  useEffect(() => {
    if (enabled && applicationsState().status === 'idle') void loadMyApplications();
  }, [enabled, state.status]);

  return {
    applications: state.applications ?? [],
    loaded: state.status === 'loaded',
    loading: enabled && (state.status === 'idle' || state.status === 'loading'),
    error: state.status === 'error',
    reload: () => void loadMyApplications(),
  };
}

// The soonest active application for the event: a multi-day event can have one per day.
export function useEventApplication(eventId: string | undefined) {
  const { applications, ...rest } = useMyApplications();
  return { application: applications.find((application) => application.eventId === eventId), ...rest };
}
