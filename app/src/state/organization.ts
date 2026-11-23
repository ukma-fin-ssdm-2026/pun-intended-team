// Written with the help of Claude
import type { Organization } from '@/api/organizations';
import { createStore } from '@/state/store';

// `none`: the account has sent no organization request (404), so it is not an organization.
export type OwnOrganizationState =
  | { status: 'idle' | 'loading' | 'none' | 'error'; organization?: undefined }
  | { status: 'loaded'; organization: Organization };

const store = createStore<{ state: OwnOrganizationState }>({ state: { status: 'idle' } });

// Counts sign-ins and sign-outs, as in state/profile.ts.
let session = 0;

export const ownOrganizationSession = () => session;

export const useOwnOrganizationState = () => store.use().state;
export const ownOrganizationState = () => store.get().state;

export function setOwnOrganizationState(state: OwnOrganizationState, from = session) {
  if (from === session) store.set({ state });
}

export function setOwnOrganization(organization: Organization, from = session) {
  setOwnOrganizationState({ status: 'loaded', organization }, from);
}

export function clearOwnOrganization() {
  session += 1;
  store.set({ state: { status: 'idle' } });
}
