// Written with the help of Claude
// AI Usage: state of the Метчі tab between the matching screens; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

type Matches = {
  // After 05.2 or 05.3 the prototype shows Т2.2: the proposal waits for an answer and a toast confirms it.
  answered: boolean;
};

const store = createStore<Matches>({ answered: false });

export const useMatches = store.use;

export function markProposalAnswered() {
  store.set({ answered: true });
}
