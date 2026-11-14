// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { filterEvents } from '@/state/catalog-filters';

import { anEvent } from './fixtures/events';

type Filters = Parameters<typeof filterEvents>[1];

const noFilters: Filters = { query: '', categoryIds: [], when: null, dates: null, districts: [], nearMe: false };

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
