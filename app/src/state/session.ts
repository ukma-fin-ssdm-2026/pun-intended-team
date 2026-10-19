// Written with the help of Claude
// AI Usage: mock session with the development switches for guest mode and catalog loading; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

// There is no sign-in yet: the session is a mock, and development builds switch it in the gallery (/dev/components).
type Session = {
  isGuest: boolean;
  // The catalog shows its skeleton (01.1) before the events, as the prototype does with mock data.
  simulateLoading: boolean;
  catalogLoading: boolean;
  // The event page as for an event the user already asked company for (02.1 "Ти вже в пошуку"); the catalog cards
  // keep the default button.
  inPool: boolean;
  // The Метчі tab as Т2.1 "Поки без метчів".
  matchesEmpty: boolean;
  // The Оголошення tab as Т3.1 "Поки тут тихо".
  announcementsEmpty: boolean;
  // "Увійди, щоб знайти компанію" (02.2) over the current screen.
  guestDialogOpen: boolean;
};

const store = createStore<Session>({
  isGuest: false,
  simulateLoading: true,
  catalogLoading: true,
  inPool: false,
  matchesEmpty: false,
  announcementsEmpty: false,
  guestDialogOpen: false,
});

export const useSession = store.use;

// Changing a switch replays the loading, so the catalog can be checked in the new mode from its first frame.
export function setGuest(isGuest: boolean) {
  store.set(({ simulateLoading }) => ({ isGuest, catalogLoading: simulateLoading }));
}

// Signing in (В4, В4.2, В8) ends guest mode.
export function signIn() {
  store.set(({ simulateLoading }) => ({ isGuest: false, catalogLoading: simulateLoading }));
}

export function setSimulateLoading(simulateLoading: boolean) {
  store.set({ simulateLoading, catalogLoading: simulateLoading });
}

export function setInPool(inPool: boolean) {
  store.set({ inPool });
}

export function setMatchesEmpty(matchesEmpty: boolean) {
  store.set({ matchesEmpty });
}

export function setAnnouncementsEmpty(announcementsEmpty: boolean) {
  store.set({ announcementsEmpty });
}

export function finishCatalogLoading() {
  store.set({ catalogLoading: false });
}

export function openGuestDialog() {
  store.set({ guestDialogOpen: true });
}

export function closeGuestDialog() {
  store.set({ guestDialogOpen: false });
}
