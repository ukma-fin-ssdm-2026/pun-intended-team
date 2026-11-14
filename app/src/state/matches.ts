// Written with the help of Claude
import type { components } from '@/api/schema';
import { createStore } from '@/state/store';

export type Match = components['schemas']['Match'];
export type MatchContacts = components['schemas']['MatchContacts'];

// What GET /me/matches returns: proposals still waiting for answers, shown as expired once past their time, and mutual
// matches.
const LISTED: Match['status'][] = ['proposed', 'accepted', 'expired', 'mutual'];

export type MatchesState =
  { status: 'idle' | 'loading' | 'error'; matches?: undefined } | { status: 'loaded'; matches: Match[] };

const store = createStore<{ state: MatchesState }>({ state: { status: 'idle' } });

// Counts sign-ins and sign-outs, as for the applications: a load or answer of an earlier session is dropped.
let session = 0;

export const matchesSession = () => session;

export const useMatchesState = () => store.use().state;
export const matchesState = () => store.get().state;

export function setMatchesState(state: MatchesState, from = session) {
  if (from === session) store.set({ state });
}

// Puts in what an answer returned, keeping the soonest shared day first; a declined match drops out.
export function putMatch(match: Match, from = session) {
  const current = store.get().state;
  if (from !== session || current.status !== 'loaded') return;
  const others = current.matches.filter(({ id }) => id !== match.id);
  const matches = LISTED.includes(match.status) ? [...others, match] : others;
  matches.sort((a, b) => firstDay(a) - firstDay(b));
  store.set({ state: { status: 'loaded', matches } });
}

function firstDay(match: Match): number {
  return Date.parse(match.days[0]?.startsAt ?? '');
}

// After a change made elsewhere, such as a withdrawal that cancels a proposal: the next screen that asks loads them again.
export function invalidateMatches() {
  if (store.get().state.status === 'loaded') store.set({ state: { status: 'idle' } });
}

// On sign-in and sign-out, so the next account never sees the previous one's matches.
export function clearMatches() {
  session += 1;
  store.set({ state: { status: 'idle' } });
}
