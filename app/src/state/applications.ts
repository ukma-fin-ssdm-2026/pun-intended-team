// Written with the help of Claude
import type { components } from '@/api/schema';
import { createStore } from '@/state/store';

export type Application = components['schemas']['Application'];

// What GET /me/applications returns; a withdrawn application drops out of the list.
const ACTIVE: Application['status'][] = ['in_pool', 'paired', 'paused'];

export type ApplicationsState =
  | { status: 'idle' | 'loading' | 'error'; applications?: undefined }
  | { status: 'loaded'; applications: Application[] };

const store = createStore<{ state: ApplicationsState }>({ state: { status: 'idle' } });

// Counts sign-ins and sign-outs, as for the profile: a load or save of an earlier session is dropped.
let session = 0;

export const applicationsSession = () => session;

export const useApplicationsState = () => store.use().state;
export const applicationsState = () => store.get().state;

export function setApplicationsState(state: ApplicationsState, from = session) {
  if (from === session) store.set({ state });
}

// Puts in what an apply or a withdraw returned, keeping the soonest session first.
export function putApplication(application: Application, from = session) {
  const current = store.get().state;
  if (from !== session || current.status !== 'loaded') return;
  const others = current.applications.filter(({ id }) => id !== application.id);
  const applications = ACTIVE.includes(application.status) ? [...others, application] : others;
  applications.sort((a, b) => firstStart(a) - firstStart(b));
  store.set({ state: { status: 'loaded', applications } });
}

function firstStart(application: Application): number {
  return Date.parse(application.sessions[0]?.startsAt ?? '');
}

// The days that still take part in matching; all of them once none does, so a finished application keeps its days.
export function openSessions(application: Application, now = new Date()): Application['sessions'] {
  const open = application.sessions.filter(({ cutoffAt }) => Date.parse(cutoffAt) > now.getTime());
  return open.length > 0 ? open : application.sessions;
}

// Where matching stands for an application in the pool: a round is coming, the pool is in open mode after the last
// round (matching.md, rule 3), or the cutoff has passed.
export function matchingPhase(application: Application, now = new Date()): 'rounds' | 'open' | 'over' {
  if (application.nextRoundAt) return 'rounds';
  return Date.parse(application.cutoffAt) > now.getTime() ? 'open' : 'over';
}

// On sign-in and sign-out, so the next account never sees the previous one's applications.
export function clearApplications() {
  session += 1;
  store.set({ state: { status: 'idle' } });
}
