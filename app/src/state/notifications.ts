// Written with the help of Claude
// AI Usage: read state of the Т5 notifications, kept in memory for the mock screens; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

// "Прочитати все" turns Т5 into Т5.2: the unread dots go.
const store = createStore<{ allRead: boolean }>({ allRead: false });

export const useNotifications = store.use;

export function readAllNotifications() {
  store.set({ allRead: true });
}
