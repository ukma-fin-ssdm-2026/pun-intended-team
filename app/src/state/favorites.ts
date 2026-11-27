// Written with the help of Claude
// AI Usage: shared favourite events, kept in memory; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

// Ids of the events the user marked "В обране"; every heart of an event reads and toggles the same entry. They live only
// in memory, so П6 Збережені події starts empty.
const store = createStore<{ eventIds: string[] }>({ eventIds: [] });

export function useFavoriteIds() {
  return store.use().eventIds;
}

export function useFavorite(eventId: string) {
  return useFavoriteIds().includes(eventId);
}

export function toggleFavorite(eventId: string) {
  store.set(({ eventIds }) => ({
    eventIds: eventIds.includes(eventId) ? eventIds.filter((id) => id !== eventId) : [...eventIds, eventId],
  }));
}
