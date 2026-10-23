// Written with the help of Claude
// AI Usage: catalog filters shared by the search, the category row and the filters sheet; reviewed by Daryna Halytska.
import { kyivDay, tomorrow, weekendDays, type KyivDay } from '@/dates';
import type { MockEvent } from '@/mocks/events';
import { createStore } from '@/state/store';

export type When = 'today' | 'tomorrow' | 'weekend';

// A day or a range picked in the Д1.1 calendar; `from` equals `to` for a single day.
export type DateRange = { from: KyivDay; to: KyivDay };

type CatalogFilters = {
  query: string;
  // Empty means all categories ("Усі").
  categoryIds: string[];
  when: When | null;
  // Days picked in Д1.1 that are not one of the quick choices; set only while `when` is null.
  dates: DateRange | null;
  districts: string[];
  // "Поруч зі мною" after Д1.2 "Дозволити"; there is no location yet, so it does not narrow the list.
  nearMe: boolean;
};

const empty: CatalogFilters = { query: '', categoryIds: [], when: null, dates: null, districts: [], nearMe: false };

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
  store.set((current) => ({ when: current.when === when ? null : when, dates: null }));
}

// "Застосувати" on Д1.1: a quick choice when the days match one, otherwise the picked days.
export function setDates(range: DateRange | null, now = new Date()) {
  const when = range ? whenOf(range, now) : null;
  store.set({ when, dates: when ? null : range });
}

export function setNearMe(nearMe: boolean) {
  store.set({ nearMe });
}

export function toggleDistrict(district: string) {
  store.set(({ districts }) => ({ districts: toggle(districts, district) }));
}

// "Скинути" clears the sheet; the search text stays.
export function resetFilters() {
  store.set({ categoryIds: [], when: null, dates: null, districts: [], nearMe: false });
}

export function daysOf(when: When, now = new Date()): KyivDay[] {
  const today = kyivDay(now);
  if (when === 'today') return [today];
  if (when === 'tomorrow') return [tomorrow(today)];
  return weekendDays(today);
}

// The quick choice that covers exactly these days, if any.
export function whenOf(range: DateRange, now = new Date()): When | null {
  const options: When[] = ['today', 'tomorrow', 'weekend'];
  return (
    options.find((when) => {
      const days = daysOf(when, now);
      return days[0] === range.from && days[days.length - 1] === range.to;
    }) ?? null
  );
}

export function filterEvents(events: MockEvent[], filters: CatalogFilters, now = new Date()): MockEvent[] {
  const search = filters.query.trim().toLocaleLowerCase('uk');
  const days = filters.when ? daysOf(filters.when, now) : undefined;
  return events.filter(
    (event) =>
      (!search || event.title.toLocaleLowerCase('uk').includes(search)) &&
      (filters.categoryIds.length === 0 || filters.categoryIds.includes(event.category.id)) &&
      (!days || days.includes(kyivDay(new Date(event.startsAt)))) &&
      (!filters.dates || inRange(kyivDay(new Date(event.startsAt)), filters.dates)) &&
      (filters.districts.length === 0 || filters.districts.includes(event.district)),
  );
}

function inRange(day: KyivDay, { from, to }: DateRange) {
  return day >= from && day <= to;
}
