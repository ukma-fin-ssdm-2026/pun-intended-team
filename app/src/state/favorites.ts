// Written with the help of Claude
// AI Usage: shared favourite events, kept in memory for the mock screens; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

// Ids of the events the user marked "В обране"; every heart of an event reads and toggles the same entry.
// П6 Збережені події starts with the three events Figma shows there: the jazz evening, the house concert and the lecture.
const store = createStore<{ eventIds: string[] }>({
  eventIds: [
    '7a2d4b5c-0002-4b00-8000-000000000001',
    '7a2d4b5c-0002-4b00-8000-000000000002',
    '7a2d4b5c-0002-4b00-8000-000000000003',
  ],
});

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
