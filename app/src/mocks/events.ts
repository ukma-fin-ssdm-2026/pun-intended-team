// Written with the help of Claude
// AI Usage: mock events taken from the Figma catalog, event page and filters; reviewed by Daryna Halytska.
import type { ImageSource } from 'expo-image';

import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];

// Same shape as the API's Event, so screens can switch to live data without changing their props.
// The API has no cover images, districts or organizers yet; those fields are mock-only. An event without a cover
// shows the coral gradient.
export type MockEvent = Event & { cover?: ImageSource; district: string; organizer: string };

// Category ids are shared by the events below; the order is the order of the Figma chips.
export const mockCategories: components['schemas']['Category'][] = [
  { id: '6f1c2a3e-0001-4a00-8000-000000000001', name: 'Концерти' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000002', name: 'Виставки' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000003', name: 'Лекції' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000004', name: 'Кіно' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000005', name: 'Театр' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000006', name: 'Стендап' },
  { id: '6f1c2a3e-0001-4a00-8000-000000000007', name: 'Воркшопи' },
];

// "Де" in the filters.
export const mockDistricts = ['Центр', 'Поділ', 'Печерськ', 'Лівий берег'];

// Dated like the Figma cards (Saturday, Sunday, Tuesday, Friday), in the week of 24 October 2026.
export const mockEvents: MockEvent[] = [
  {
    id: '7a2d4b5c-0002-4b00-8000-000000000001',
    title: 'Джаз-вечір у Мистецькому Арсеналі',
    description:
      'Вечір камерного джазу в залах Мистецького Арсеналу: квартет виконає авторські композиції та імпровізації на теми українських пісень. Після концерту музиканти залишаться поспілкуватися з гостями.',
    category: { id: '6f1c2a3e-0001-4a00-8000-000000000001', name: 'Концерт' },
    venue: {
      id: '8b3e5c6d-0003-4c00-8000-000000000001',
      name: 'Мистецький Арсенал',
      address: 'вул. Лаврська, 10–12',
      location: { lat: 50.4381, lng: 30.5576 },
    },
    startsAt: '2026-10-24T16:00:00Z',
    endsAt: '2026-10-24T18:30:00Z',
    source: 'organization',
    status: 'published',
    cover: require('@/assets/images/events/jazz-evening.png'),
    district: 'Печерськ',
    organizer: 'Мистецький Арсенал',
  },
  {
    id: '7a2d4b5c-0002-4b00-8000-000000000002',
    title: 'Квартирник: акустика при свічках',
    description:
      'Акустичний вечір у затишній квартирі на Подолі: гітара, віолончель і пісні, які зазвичай не звучать зі сцени. Місць небагато, тож приходь вчасно.',
    category: { id: '6f1c2a3e-0001-4a00-8000-000000000001', name: 'Музика' },
    venue: {
      id: '8b3e5c6d-0003-4c00-8000-000000000002',
      name: 'Поділ',
      address: 'вул. Межигірська, 3',
      location: { lat: 50.4655, lng: 30.5155 },
    },
    startsAt: '2026-10-25T18:00:00Z',
    endsAt: '2026-10-25T20:00:00Z',
    source: 'import',
    status: 'published',
    cover: require('@/assets/images/events/kvartyrnyk.png'),
    district: 'Поділ',
    organizer: 'Квартирники Києва',
  },
  {
    id: '7a2d4b5c-0002-4b00-8000-000000000003',
    title: 'Лекція: як читати сучасне мистецтво',
    description:
      'Куратор розповідає, з чого почати знайомство із сучасним мистецтвом: як дивитися на роботи, що читати в експлікаціях і чому «я теж так можу» — нормальна перша реакція.',
    category: { id: '6f1c2a3e-0001-4a00-8000-000000000003', name: 'Лекції' },
    venue: {
      id: '8b3e5c6d-0003-4c00-8000-000000000001',
      name: 'Мистецький Арсенал',
      address: 'вул. Лаврська, 10–12',
      location: { lat: 50.4381, lng: 30.5576 },
    },
    startsAt: '2026-10-27T14:00:00Z',
    endsAt: '2026-10-27T15:30:00Z',
    source: 'organization',
    status: 'published',
    district: 'Печерськ',
    organizer: 'Мистецький Арсенал',
  },
  {
    id: '7a2d4b5c-0002-4b00-8000-000000000004',
    title: 'Нічний кінопоказ під відкритим небом',
    description:
      'Кіно на траві біля Видубицького монастиря: класика українського кіно на великому екрані під зорями. Візьми плед і теплий одяг, чай буде на місці.',
    category: { id: '6f1c2a3e-0001-4a00-8000-000000000004', name: 'Кіно' },
    venue: {
      id: '8b3e5c6d-0003-4c00-8000-000000000003',
      name: 'Видубичі',
      address: 'вул. Видубицька, 40',
      location: { lat: 50.4157, lng: 30.5654 },
    },
    startsAt: '2026-10-30T19:00:00Z',
    endsAt: '2026-10-30T21:30:00Z',
    source: 'import',
    status: 'published',
    // Figma uses the jazz evening cover for this card too.
    cover: require('@/assets/images/events/jazz-evening.png'),
    district: 'Печерськ',
    organizer: 'Кіно під зорями',
  },
];

export function findMockEvent(id: string): MockEvent | undefined {
  return mockEvents.find((event) => event.id === id);
}
