// Written with the help of Claude
import { afterEach, describe, expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import {
  eventQuery,
  filterEvents,
  hasFilters,
  resetFilters,
  setNear,
  setRadius,
  useCatalogFilters,
} from '@/state/catalog-filters';

import { anEvent } from './fixtures/events';

type Filters = Parameters<typeof filterEvents>[1];

const noFilters: Filters = {
  query: '',
  categoryIds: [],
  when: null,
  dates: null,
  districts: [],
  near: null,
  radiusKm: 3,
};

// Tuesday 10 November 2026, 12:00 in Kyiv.
const now = new Date('2026-11-10T10:00:00Z');

// As the API's date filter: an event is on every day from its start to its end.
describe('filterEvents by day', () => {
  const concert = anEvent('e1', 'Концерт');
  // A museum open 10:00–14:00 every day until 1 May, imported from today's show.
  const museum = {
    ...anEvent('e2', 'Музей медуз'),
    startsAt: '2026-11-10T10:00:00+02:00',
    endsAt: '2027-05-01T14:00:00+03:00',
  };
  const titles = (filters: Partial<Filters>) =>
    filterEvents([concert, museum], { ...noFilters, ...filters }, now).map(({ title }) => title);

  test('keeps both on the day they start', () => {
    expect(titles({ when: 'today' })).toEqual(['Концерт', 'Музей медуз']);
  });

  test('keeps a run of shows on a later day of it', () => {
    expect(titles({ when: 'tomorrow' })).toEqual(['Музей медуз']);
    expect(titles({ when: 'weekend' })).toEqual(['Музей медуз']);
  });

  test('keeps a run of shows for picked days that cover one of its days', () => {
    expect(titles({ dates: { from: '2026-12-20', to: '2026-12-24' } })).toEqual(['Музей медуз']);
  });

  test('leaves out a run of shows after its last day', () => {
    expect(titles({ dates: { from: '2027-05-02', to: '2027-05-03' } })).toEqual([]);
  });

  test('leaves out an event before the picked days', () => {
    expect(titles({ dates: { from: '2026-11-11', to: '2026-11-12' } })).toEqual(['Музей медуз']);
  });
});

// FR-007: what the catalog asks the API for.
describe('eventQuery', () => {
  test('asks for every picked category', () => {
    expect(eventQuery({ ...noFilters, categoryIds: ['c1', 'c2'] }, now).categoryIds).toEqual(['c1', 'c2']);
  });

  test('leaves the categories out when none is picked', () => {
    expect(eventQuery(noFilters, now).categoryIds).toBeUndefined();
  });

  test('sends the point and the radius with "Поруч зі мною"', () => {
    const query = eventQuery({ ...noFilters, near: { lat: 50.45, lng: 30.524 }, radiusKm: 5 }, now);

    expect([query.lat, query.lng, query.radiusKm]).toEqual([50.45, 30.524, 5]);
  });

  test('sends no point without "Поруч зі мною"', () => {
    const query = eventQuery({ ...noFilters, radiusKm: 5 }, now);

    expect([query.lat, query.lng, query.radiusKm]).toEqual([undefined, undefined, undefined]);
  });
});

describe('hasFilters', () => {
  test('is false for the empty filters', () => {
    expect(hasFilters(noFilters)).toBe(false);
  });

  const narrowing: [string, Partial<Filters>][] = [
    ['a search text', { query: 'джаз' }],
    ['a category', { categoryIds: ['c1'] }],
    ['a quick day', { when: 'today' }],
    ['picked days', { dates: { from: '2026-11-11', to: '2026-11-12' } }],
    ['a district', { districts: ['Поділ'] }],
    ['"Поруч зі мною"', { near: { lat: 50.45, lng: 30.524 } }],
  ];
  test.each(narrowing)('is true with %s', (_, filters) => {
    expect(hasFilters({ ...noFilters, ...filters })).toBe(true);
  });
});

describe('setNear', () => {
  afterEach(async () => {
    await act(resetFilters);
  });

  test('keeps three decimals of the coordinates', async () => {
    const { result } = await renderHook(() => useCatalogFilters());

    await act(() => setNear({ lat: 50.450_449, lng: 30.523_6 }));

    expect(result.current.near).toEqual({ lat: 50.45, lng: 30.524 });
  });

  test('resets the point and the radius with the other filters', async () => {
    const { result } = await renderHook(() => useCatalogFilters());
    await act(() => {
      setNear({ lat: 50.45, lng: 30.524 });
      setRadius(10);
    });

    await act(resetFilters);

    expect([result.current.near, result.current.radiusKm]).toEqual([null, 3]);
  });
});
