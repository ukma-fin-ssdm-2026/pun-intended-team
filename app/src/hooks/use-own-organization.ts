// Written with the help of Claude
import { useEffect } from 'react';

import { getMyOrganization } from '@/api/organizations';
import {
  ownOrganizationSession,
  ownOrganizationState,
  setOwnOrganization,
  setOwnOrganizationState,
  useOwnOrganizationState,
} from '@/state/organization';
import { useSession } from '@/state/session';

let request: { session: number; done: Promise<void> } | undefined;

function loadOwnOrganization() {
  const from = ownOrganizationSession();
  if (request?.session === from) return request.done;
  const done = (async () => {
    // A reload keeps the organization shown until the answer arrives.
    if (ownOrganizationState().status !== 'loaded') setOwnOrganizationState({ status: 'loading' }, from);
    const result = await getMyOrganization();
    if (result.ok) setOwnOrganization(result.data, from);
    else setOwnOrganizationState({ status: result.status === 404 ? 'none' : 'error' }, from);
  })().finally(() => {
    if (request?.done === done) request = undefined;
  });
  request = { session: from, done };
  return done;
}

// The signed-in account's organization request, shared by every screen, as useProfile.
export function useOwnOrganization() {
  const state = useOwnOrganizationState();
  const { signedIn, isGuest } = useSession();
  const enabled = signedIn && !isGuest;

  useEffect(() => {
    if (enabled && ownOrganizationState().status === 'idle') void loadOwnOrganization();
  }, [enabled, state.status]);

  return {
    data: state.organization,
    none: state.status === 'none',
    loading: state.status === 'idle' || state.status === 'loading',
    error: state.status === 'error',
    reload: () => void loadOwnOrganization(),
    set: setOwnOrganization,
  };
}
