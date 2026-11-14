// Written with the help of Claude
import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];

// Two Kyiv venues and catalog events at them, for the map tests.
export const arsenal = {
  id: 'v1',
  name: 'Мистецький Арсенал',
  address: 'вул. Лаврська, 10–12',
  location: { lat: 50.4359, lng: 30.5578 },
};

export const atlas = {
  id: 'v2',
  name: 'Атлас',
  address: 'вул. Січових Стрільців, 37',
  location: { lat: 50.4558, lng: 30.4964 },
};

export function anEvent(id: string, title: string, venue = arsenal): Event {
  return {
    id,
    title,
    description: '',
    category: { id: 'c1', name: 'Концерти' },
    venue,
    startsAt: '2026-11-10T19:00:00+02:00',
    endsAt: '2026-11-10T21:00:00+02:00',
    imageUrl: null,
    sourceUrl: null,
    source: 'import',
    status: 'published',
  };
}
