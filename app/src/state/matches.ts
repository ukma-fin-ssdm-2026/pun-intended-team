// Written with the help of Claude
// AI Usage: state of the Метчі tab between the matching screens; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

export type ProposalAnswer = 'accepted' | 'declined';

type Matches = {
  // After 05.2 or 05.3 the prototype shows Т2.2: the proposal waits for an answer and a toast confirms it, with its own
  // text after accepting and after declining.
  answer?: ProposalAnswer;
};

const store = createStore<Matches>({});

export const useMatches = store.use;

export function markProposalAnswered(answer: ProposalAnswer) {
  store.set({ answer });
}
