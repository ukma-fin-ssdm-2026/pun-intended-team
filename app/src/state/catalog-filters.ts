// Written with the help of Claude
// AI Usage: catalog filters shared by the search, the category row and the filters sheet; reviewed by Daryna Halytska.
import type { components } from '@/api/schema';
import { kyivDay, tomorrow, weekendDays, type KyivDay } from '@/dates';
import type { EventQuery } from '@/hooks/use-events';
import { createStore } from '@/state/store';

type FilterableEvent = components['schemas']['Event'];

export type When = 'today' | 'tomorrow' | 'weekend';

// The radius choices of "Поруч зі мною", in kilometres; the API takes up to 50.
export const RADIUS_OPTIONS = [1, 3, 5, 10] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];
const DEFAULT_RADIUS_KM: RadiusKm = 3;

export type Point = { lat: number; lng: number };

// A day or a range picked in the Д1.1 calendar; `from` equals `to` for a single day.
export type DateRange = { from: KyivDay; to: KyivDay };

type CatalogFilters = {
  query: string;
  // Empty means all categories ("Усі").
  categoryIds: string[];
  when: When | null;
  // Days picked in Д1.1 that are not one of the quick choices; set only while `when` is null.
  dates: DateRange | null;
  // "Поруч зі мною": where the user was when they turned it on, rounded; null while it is off.
  near: Point | null;
  radiusKm: RadiusKm;
};

const empty: CatalogFilters = {
  query: '',
  categoryIds: [],
  when: null,
  dates: null,
  near: null,
  radiusKm: DEFAULT_RADIUS_KM,
};

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

// Three decimals are about 100 m: enough for a radius of a kilometre, and the API never learns the exact spot.
const roundCoordinate = (value: number) => Math.round(value * 1000) / 1000;

export function setNear(point: Point | null) {
  store.set({ near: point && { lat: roundCoordinate(point.lat), lng: roundCoordinate(point.lng) } });
}

export function setRadius(radiusKm: RadiusKm) {
  store.set({ radiusKm });
}

// "Скинути" clears the sheet; the search text stays.
export function resetFilters() {
  store.set({ categoryIds: [], when: null, dates: null, near: null, radiusKm: DEFAULT_RADIUS_KM });
}

// Whether anything narrows the list, so an empty one says "nothing matches" rather than "no events yet".
export function hasFilters(filters: CatalogFilters): boolean {
  return (
    filters.query.trim() !== '' || filters.categoryIds.length > 0 || !!filters.when || !!filters.dates || !!filters.near
  );
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

// What the API narrows by: the categories, the days and the distance. The search text is left to `filterEvents`, which
// sees only the pages loaded so far.
export function eventQuery(filters: CatalogFilters, now = new Date()): EventQuery {
  const days = filters.when ? daysOf(filters.when, now) : filters.dates ? [filters.dates.from, filters.dates.to] : [];
  return {
    categoryIds: filters.categoryIds.length > 0 ? filters.categoryIds : undefined,
    from: days[0],
    to: days[days.length - 1],
    ...(filters.near && { ...filters.near, radiusKm: filters.radiusKm }),
  };
}

export function filterEvents<T extends FilterableEvent>(events: T[], filters: CatalogFilters, now = new Date()): T[] {
  const search = filters.query.trim().toLocaleLowerCase('uk');
  const days = filters.when ? daysOf(filters.when, now) : undefined;
  return events.filter(
    (event) =>
      (!search || event.title.toLocaleLowerCase('uk').includes(search)) &&
      (filters.categoryIds.length === 0 || filters.categoryIds.includes(event.category.id)) &&
      (!days || overlaps(event, { from: days[0], to: days[days.length - 1] })) &&
      (!filters.dates || overlaps(event, filters.dates)),
  );
}

// As the API's date filter (FR-007): an event is on the days from its start to its end, so a run of shows until May
// shows on every one of them, not only on its first.
function overlaps(event: FilterableEvent, { from, to }: DateRange) {
  return kyivDay(new Date(event.startsAt)) <= to && kyivDay(new Date(event.endsAt)) >= from;
}
