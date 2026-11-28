// Written with the help of Claude
import type { ListingPlace } from '@/api/places';
import { createStore } from '@/state/store';

// The place picked on Д2.1, which the post editor (Д2) sends with the listing; cleared when the editor closes.
const store = createStore<{ place?: ListingPlace }>({});

export const usePickedPlace = () => store.use().place;

export const pickedPlace = () => store.get().place;

export function pickPlace(place: ListingPlace) {
  store.set({ place });
}

export function clearPickedPlace() {
  store.set({ place: undefined });
}
