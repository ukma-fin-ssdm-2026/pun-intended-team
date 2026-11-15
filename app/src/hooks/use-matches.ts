// Written with the help of Claude
import { useEffect } from 'react';

import { loadMyMatches } from '@/api/matches';
import { matchesState, useMatchesState } from '@/state/matches';
import { useSession } from '@/state/session';

// The signed-in account's pending and mutual matches, shared by every screen; loaded on first use and kept up to date
// by the answers in api/matches.ts.
export function useMyMatches() {
  const state = useMatchesState();
  // A guest has no matches, and its token gets a 401 here.
  const { signedIn, isGuest } = useSession();
  const enabled = signedIn && !isGuest;

  useEffect(() => {
    if (enabled && matchesState().status === 'idle') void loadMyMatches();
  }, [enabled, state.status]);

  return {
    matches: state.matches ?? [],
    loaded: state.status === 'loaded',
    loading: enabled && (state.status === 'idle' || state.status === 'loading'),
    error: state.status === 'error',
    reload: () => void loadMyMatches(),
  };
}

// The match of an application; it has at most one that is pending or mutual.
export function useApplicationMatch(applicationId: string | undefined) {
  const { matches, ...rest } = useMyMatches();
  return { match: matches.find((match) => match.applicationId === applicationId), ...rest };
}

export function useMatch(id: string | undefined) {
  const { matches, ...rest } = useMyMatches();
  return { match: matches.find((match) => match.id === id), ...rest };
}
