// Written with the help of Claude
// AI Usage: mock organization account from the Figma "О1–О3 Організація" screens; reviewed by Daryna Halytska.
import { findMockEvent, type MockEvent } from '@/mocks/events';

export type OrganizationEventStatus = 'published' | 'draft' | 'cancelled';

export type OrganizationEvent = { status: OrganizationEventStatus; event: MockEvent };

// The organization's events are the mock catalog events, so their dates are shifted like the catalog's.
const event = (id: string) => {
  const found = findMockEvent(id);
  if (!found) throw new Error(`Unknown mock event ${id}`);
  return found;
};

export const mockOrganization = {
  name: 'Мистецький Арсенал',
  summary: '2 опубліковано · 1 чернетка',
  // О1.1: the summary when there are no events.
  emptySummary: 'Поки що жодної події',
  events: [
    { status: 'published', event: event('7a2d4b5c-0002-4b00-8000-000000000001') },
    { status: 'draft', event: event('7a2d4b5c-0002-4b00-8000-000000000003') },
    { status: 'cancelled', event: event('7a2d4b5c-0002-4b00-8000-000000000005') },
  ] satisfies OrganizationEvent[],
};

// Сторінка організатора: the organizer of the jazz evening, as the event page links to it.
export const mockOrganizer = {
  name: 'Мистецький Арсенал',
  kind: 'Організація · Печерськ, Київ',
  about: 'Культурний комплекс у центрі Києва: виставки сучасного мистецтва, концерти, лекції та фестивалі.',
  // "Сайт" and "Instagram" open external pages that have no design yet.
  links: ['Сайт', 'Instagram'],
  eventsLabel: '3 події',
  events: [
    event('7a2d4b5c-0002-4b00-8000-000000000001'),
    event('7a2d4b5c-0002-4b00-8000-000000000003'),
    event('7a2d4b5c-0002-4b00-8000-000000000007'),
  ],
};

// О4 Налаштування: the organization profile as filled in.
export const mockOrganizationSettings = {
  name: 'Мистецький Арсенал',
  about: 'Культурний комплекс у центрі Києва',
  site: 'artarsenal.in.ua',
  instagram: '@artarsenal',
};
