// Written with the help of Claude
// AI Usage: catalog filters shared by the search, the category row and the filters sheet; reviewed by Daryna Halytska.
import { kyivDay, tomorrow, weekendDays } from '@/dates';
import type { MockEvent } from '@/mocks/events';
import { createStore } from '@/state/store';

export type When = 'today' | 'tomorrow' | 'weekend';

type CatalogFilters = {
  query: string;
  // Empty means all categories ("Усі").
  categoryIds: string[];
  when: When | null;
  districts: string[];
};

const empty: CatalogFilters = { query: '', categoryIds: [], when: null, districts: [] };

const store = createStore<CatalogFilters>(empty);

export const useCatalogFilters = store.use;

export function setQuery(query: string) {
  store.set({ query });
}

// The row under the search picks one category or all; the sheet can pick several.
export function selectCategory(id: string | undefined) {
  store.set({ categoryIds: id ? [id] : [] });
}

const toggle = (list: string[], item: string) =>
  list.includes(item) ? list.filter((value) => value !== item) : [...list, item];

export function toggleCategory(id: string) {
  store.set(({ categoryIds }) => ({ categoryIds: toggle(categoryIds, id) }));
}

export function toggleWhen(when: When) {
  store.set((current) => ({ when: current.when === when ? null : when }));
}

export function toggleDistrict(district: string) {
  store.set(({ districts }) => ({ districts: toggle(districts, district) }));
}

// "Скинути" clears the sheet; the search text stays.
export function resetFilters() {
  store.set({ categoryIds: [], when: null, districts: [] });
}

function daysOf(when: When, now: Date): string[] {
  const today = kyivDay(now);
  if (when === 'today') return [today];
  if (when === 'tomorrow') return [tomorrow(today)];
  return weekendDays(today);
}

export function filterEvents(events: MockEvent[], filters: CatalogFilters, now = new Date()): MockEvent[] {
  const search = filters.query.trim().toLocaleLowerCase('uk');
  const days = filters.when ? daysOf(filters.when, now) : undefined;
  return events.filter(
    (event) =>
      (!search || event.title.toLocaleLowerCase('uk').includes(search)) &&
      (filters.categoryIds.length === 0 || filters.categoryIds.includes(event.category.id)) &&
      (!days || days.includes(kyivDay(new Date(event.startsAt)))) &&
      (filters.districts.length === 0 || filters.districts.includes(event.district)),
  );
}
