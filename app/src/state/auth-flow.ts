// Written with the help of Claude
import { createStore } from '@/state/store';

// What the sign-up (В5 → В6 → В4.2) and password reset (В4.1 → В6 → В4.2) screens pass on to the next one, kept out
// of the URL since it holds the phone number and the code.
type AuthFlow = {
  purpose: 'register' | 'reset';
  phone: string;
  dateOfBirth?: string;
  code?: string;
  // From `verify`; kept so finishing the registration can be retried after the code is used up.
  registrationToken?: string;
};

const store = createStore<AuthFlow>({ purpose: 'register', phone: '' });

export const getAuthFlow = store.get;

export function startAuthFlow(flow: AuthFlow) {
  store.set({ code: undefined, dateOfBirth: undefined, registrationToken: undefined, ...flow });
}

export function updateAuthFlow(update: Partial<AuthFlow>) {
  store.set(update);
}
