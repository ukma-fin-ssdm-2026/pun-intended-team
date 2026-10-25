// Written with the help of Claude
import type { Category } from '../../../dist/core/catalog/types/category.js';
import type { Event, NewEvent } from '../../../dist/core/catalog/types/event.js';
import type { Organization } from '../../../dist/core/catalog/types/organization.js';
import type { Venue } from '../../../dist/core/catalog/types/venue.js';
import { ACCOUNT_ID } from './accounts.ts';

export const CATEGORY_ID = 'c0000000-0000-4000-8000-000000000001';
export const VENUE_ID = 'b0000000-0000-4000-8000-000000000001';
export const EVENT_ID = 'e0000000-0000-4000-8000-000000000001';

export function aCategory(overrides: Partial<Category> = {}): Category {
  return { id: CATEGORY_ID, name: 'Exhibitions', isActive: true, ...overrides };
}

/** A venue of the organization with ACCOUNT_ID. */
export function aVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: VENUE_ID,
    name: 'Natalka Park lawn',
    address: 'Naberezhno-Luhova St, Kyiv',
    location: { lat: 50.4825, lng: 30.5181 },
    source: 'organization',
    organizationId: ACCOUNT_ID,
    ...overrides,
  };
}

/** The verified organization of the account ACCOUNT_ID. */
export function anOrganization(overrides: Partial<Organization> = {}): Organization {
  return { accountId: ACCOUNT_ID, name: 'Natalka Park', verificationStatus: 'verified', ...overrides };
}

/** A published event of ACCOUNT_ID, a week after NOW. */
export function anEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: EVENT_ID,
    title: 'Film quiz night',
    description: 'Teams of up to four, questions on Ukrainian cinema.',
    category: { id: CATEGORY_ID, name: 'Exhibitions' },
    venue: aVenue(),
    startsAt: '2026-10-22T19:00:00+03:00',
    endsAt: '2026-10-22T21:00:00+03:00',
    source: 'organization',
    status: 'published',
    organizationId: ACCOUNT_ID,
    ...overrides,
  };
}

/** The fields an organization sends to create or edit anEvent(). */
export function aNewEvent(overrides: Partial<NewEvent> = {}): NewEvent {
  return {
    title: 'Film quiz night',
    description: 'Teams of up to four, questions on Ukrainian cinema.',
    categoryId: CATEGORY_ID,
    venueId: VENUE_ID,
    startsAt: '2026-10-22T19:00:00+03:00',
    endsAt: '2026-10-22T21:00:00+03:00',
    ...overrides,
  };
}
