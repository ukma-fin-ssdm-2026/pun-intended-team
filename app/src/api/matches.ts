// Written with the help of Claude
import { invalidateApplications } from '@/state/applications';
import {
  matchesSession,
  matchesState,
  putMatch,
  setMatchesState,
  type Match,
  type MatchContacts,
} from '@/state/matches';

import { apiClient } from './client';
import { call, type ApiResult } from './public-client';

let request: { session: number; done: Promise<void> } | undefined;

// One request at a time per session, however many screens ask.
export function loadMyMatches() {
  const from = matchesSession();
  if (request?.session === from) return request.done;
  const done = (async () => {
    setMatchesState({ status: 'loading' }, from);
    const result = await call(() => apiClient.GET('/api/v1/me/matches'));
    setMatchesState(result.ok ? { status: 'loaded', matches: result.data } : { status: 'error' }, from);
  })().finally(() => {
    if (request?.done === done) request = undefined;
  });
  request = { session: from, done };
  return done;
}

// An answer also moves the applications: a decline returns both to the pool.
async function answered(result: Promise<ApiResult<Match>>) {
  const from = matchesSession();
  const outcome = await result;
  if (outcome.ok) {
    if (matchesState().status === 'loaded') putMatch(outcome.data, from);
    else void loadMyMatches();
    invalidateApplications();
  }
  return outcome;
}

export function acceptMatch(id: string) {
  return answered(call(() => apiClient.POST('/api/v1/matches/{id}/accept', { params: { path: { id } } })));
}

export function declineMatch(id: string) {
  return answered(call(() => apiClient.POST('/api/v1/matches/{id}/decline', { params: { path: { id } } })));
}

// Only a mutual match has them; the API answers 404 before that.
export function getMatchContacts(id: string): Promise<ApiResult<MatchContacts>> {
  return call(() => apiClient.GET('/api/v1/matches/{id}/contacts', { params: { path: { id } } }));
}
