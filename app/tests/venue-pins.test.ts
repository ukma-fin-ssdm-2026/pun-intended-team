// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { clampToKyiv, isInKyiv, KYIV_BOUNDS } from '@/components/map/kyiv';
import { eventsLabel, matchesMapSearch, venuesOf } from '@/components/map/venue-pins';

import { anEvent, arsenal, atlas } from './fixtures/events';

// FR-012
describe('venuesOf', () => {
  test('gives one pin per venue with its events, in the order of the events', () => {
    const events = [anEvent('e1', 'Джаз'), anEvent('e2', 'Рок', atlas), anEvent('e3', 'Лекція')];

    expect(venuesOf(events)).toEqual([
      { venue: arsenal, events: [events[0], events[2]] },
      { venue: atlas, events: [events[1]] },
    ]);
  });
});

describe('eventsLabel', () => {
  test.each([
    [1, '1 подія'],
    [3, '3 події'],
    [5, '5 подій'],
    [11, '11 подій'],
    [21, '21 подія'],
    [22, '22 події'],
    [14, '14 подій'],
  ])('counts %i as "%s"', (count, label) => {
    expect(eventsLabel(count)).toBe(label);
  });
});

describe('matchesMapSearch', () => {
  test('matches the event title or the venue name, in any letter case', () => {
    const event = anEvent('e1', 'Джаз-вечір');

    expect(matchesMapSearch(event, 'джаз')).toBe(true);
    expect(matchesMapSearch(event, 'АРСЕНАЛ')).toBe(true);
    expect(matchesMapSearch(event, 'рок')).toBe(false);
    expect(matchesMapSearch(event, '  ')).toBe(true);
  });
});

describe('Kyiv bounds', () => {
  test('keep the map in the city', () => {
    expect(isInKyiv(arsenal.location)).toBe(true);
    // Simferopol
    expect(isInKyiv({ lat: 44.95, lng: 34.1 })).toBe(false);
    expect(clampToKyiv({ lat: 44.95, lng: 34.1 })).toEqual({ lat: KYIV_BOUNDS.south, lng: KYIV_BOUNDS.east });
  });
});
