// Written with the help of Claude
// AI Usage: mock session with the development switches for guest mode and catalog loading; reviewed by Daryna Halytska.
import { createStore } from '@/state/store';

// Whether an account is signed in comes from src/api/session.ts; the rest are mock switches that development builds
// change in the gallery (/dev/components).
type Session = {
  // False until the stored session is read on launch.
  restored: boolean;
  signedIn: boolean;
  // `role` of the account's access token; known once a token is issued or renewed.
  role?: string;
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
  // Т5 as Т5.1: "Олена хоче піти з тобою" answers the user's post.
  joinRequest: boolean;
  // О1 as О1.1: the organization has no events yet.
  organizationEmpty: boolean;
  // "Увійди, щоб знайти компанію" (02.2) over the current screen.
  guestDialogOpen: boolean;
};

const store = createStore<Session>({
  restored: false,
  signedIn: false,
  isGuest: false,
  simulateLoading: true,
  catalogLoading: true,
  inPool: false,
  matchesEmpty: false,
  announcementsEmpty: false,
  joinRequest: false,
  organizationEmpty: false,
  guestDialogOpen: false,
});

export const useSession = store.use;

// Changing a switch replays the loading, so the catalog can be checked in the new mode from its first frame.
export function setGuest(isGuest: boolean) {
  store.set(({ simulateLoading }) => ({ isGuest, catalogLoading: simulateLoading }));
}

// Signing in or out ends guest mode.
export function setSignedIn(signedIn: boolean) {
  store.set(({ role }) => ({ restored: true, signedIn, isGuest: false, role: signedIn ? role : undefined }));
}

export function setRole(role: string | undefined) {
  store.set({ role });
}

// Opening the catalog after signing in (В4, В4.2, В8) replays its loading.
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

export function setJoinRequest(joinRequest: boolean) {
  store.set({ joinRequest });
}

export function setOrganizationEmpty(organizationEmpty: boolean) {
  store.set({ organizationEmpty });
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
