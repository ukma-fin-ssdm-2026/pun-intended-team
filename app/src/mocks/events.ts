// Written with the help of Claude
// AI Usage: mock events taken from the Figma catalog screen; reviewed by Daryna Halytska.
import type { ImageSource } from 'expo-image';

import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];

// Same shape as the API's Event, so screens can switch to live data without changing their props.
// The API has no cover images yet; `cover` is mock-only.
export type MockEvent = Event & { cover: ImageSource };

export const mockCategories: components['schemas']['Category'][] = [
  { id: '6f1c2a3e-0001-4a00-8000-000000000001', name: 'Концерти' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000002', name: 'Виставки' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000003', name: 'Лекції' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000004', name: 'Кіно' },
];

export const mockEvents: MockEvent[] = [
  {
    id: '7a2d4b5c-0002-4b00-8000-000000000001',
    title: 'Джаз-вечір у Мистецькому Арсеналі',
    description: 'Живий джаз у залах Мистецького Арсеналу.',
    category: { id: '6f1c2a3e-0001-4a00-8000-000000000001', name: 'Концерт' },
    venue: {
      id: '8b3e5c6d-0003-4c00-8000-000000000001',
      name: 'Мистецький Арсенал',
      address: 'вул. Лаврська, 10-12, Київ',
      location: { lat: 50.4381, lng: 30.5576 },
    },
    startsAt: '2026-10-18T16:00:00Z',
    endsAt: '2026-10-18T19:00:00Z',
    source: 'organization',
    status: 'published',
    cover: require('@/assets/images/events/jazz-evening.png'),
  },
  {
    id: '7a2d4b5c-0002-4b00-8000-000000000002',
    title: 'Квартирник: акустика при свічках',
    description: 'Акустичний вечір у затишній квартирі на Подолі.',
    category: { id: '6f1c2a3e-0001-4a00-8000-000000000001', name: 'Музика' },
    venue: {
      id: '8b3e5c6d-0003-4c00-8000-000000000002',
      name: 'Поділ',
      address: 'Київ',
      location: { lat: 50.4655, lng: 30.5155 },
    },
    startsAt: '2026-10-19T17:00:00Z',
    endsAt: '2026-10-19T20:00:00Z',
    source: 'import',
    status: 'published',
    cover: require('@/assets/images/events/kvartyrnyk.png'),
  },
];
