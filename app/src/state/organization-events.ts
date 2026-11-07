// Written with the help of Claude
import type { Event } from '@/api/events';
import { createStore } from '@/state/store';

// The events the organization created, changed or cancelled since it signed in, as the API answered. The API has no
// list of an organization's own events, so the rest of О1 stays on mocks until it has. Newest first.
const store = createStore<{ events: Event[] }>({ events: [] });

export const useOwnEvents = () => store.use().events;

export function rememberOwnEvent(event: Event) {
  store.set(({ events }) => ({
    events: events.some((known) => known.id === event.id)
      ? events.map((known) => (known.id === event.id ? event : known))
      : [event, ...events],
  }));
}

// On sign-in and sign-out, so the next account never sees the previous one's events.
export function clearOwnEvents() {
  store.set({ events: [] });
}
