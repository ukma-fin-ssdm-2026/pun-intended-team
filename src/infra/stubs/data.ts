// Written with the help of Claude
// Stub data until the database is connected. Kept in memory: changes made
// through the API last until the server restarts.
import type { Caller } from '../../core/identity/types/caller.js';
import type { Event } from '../../core/catalog/types/event.js';
import type { Category } from '../../core/catalog/types/category.js';
import type { Organization } from '../../core/catalog/types/organization.js';
import type { Venue } from '../../core/catalog/types/venue.js';
import type { Listing } from '../../core/listings/types/listing.js';
import type { ProfileSummary } from '../../core/profiles/types/profile.js';

export const accounts = {
  olena: 'c3a1f6d2-4b7e-4f0a-9d21-6e8b5a3c7f14',
  taras: 'd8e2b4c6-1a3f-4e5d-8b7c-9f0a2c4e6b18',
  filmClub: 'e1f3a5c7-9b2d-4f6e-8a0c-3d5f7b9e1a2c',
  newGallery: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
  admin: 'a0c2e4f6-8b1d-4a3c-9e5f-7b9d1f3a5c6e',
} as const;

/** Demo tokens for Swagger UI and curl, until sign-in is implemented. */
export const sessions: Record<string, Caller> = {
  'stub-guest': { kind: 'guest' },
  'stub-user': { kind: 'account', accountId: accounts.olena, role: 'user' },
  'stub-user-2': { kind: 'account', accountId: accounts.taras, role: 'user' },
  'stub-org': { kind: 'account', accountId: accounts.filmClub, role: 'user' },
  'stub-org-pending': { kind: 'account', accountId: accounts.newGallery, role: 'user' },
  'stub-admin': { kind: 'account', accountId: accounts.admin, role: 'admin' },
};

export const profiles: ProfileSummary[] = [
  { accountId: accounts.olena, username: 'olena_k', displayName: 'Olena' },
  { accountId: accounts.taras, username: 'taras.m', displayName: 'Taras' },
];

export const organizations: Organization[] = [
  { accountId: accounts.filmClub, name: 'Podil Film Club', verificationStatus: 'verified' },
  { accountId: accounts.newGallery, name: 'New Gallery', verificationStatus: 'pending' },
];

export const categories: Category[] = [
  { id: '0b6f2d4a-8c1e-4a3b-9d5f-7e2a4c6b8d01', name: 'Cinema', isActive: true },
  { id: '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02', name: 'Exhibitions', isActive: true },
  { id: '2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03', name: 'Concerts', isActive: true },
  { id: '3e9c5a7d-1f4b-4d6e-8a8c-0b5d7f9e1a04', name: 'Poetry slams', isActive: false },
];

export const venues: Venue[] = [
  {
    id: '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05',
    name: 'Natalka Park lawn',
    address: 'Naberezhno-Luhova St, Kyiv',
    location: { lat: 50.4825, lng: 30.5181 },
    organizationId: accounts.filmClub,
  },
  {
    id: '6b2d4f6a-8c0e-4a2b-9d4f-6a8b0c2e4f06',
    name: 'Mystetskyi Arsenal',
    address: '10-12 Lavrska St, Kyiv',
    location: { lat: 50.4357, lng: 30.5555 },
    organizationId: null,
  },
  {
    id: '7c3e5a7b-9d1f-4b3c-8e5a-7b9c1d3f5a07',
    name: 'New Gallery hall',
    address: '5 Velyka Vasylkivska St, Kyiv',
    location: { lat: 50.4401, lng: 30.5203 },
    organizationId: accounts.newGallery,
  },
];

/** How an event row is stored: category and venue by id, joined on read. */
export type StoredEvent = Omit<Event, 'category' | 'venue'> & { categoryId: string; venueId: string };

export const events: StoredEvent[] = [
  {
    id: '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10',
    title: 'Open-air film night: Shadows of Forgotten Ancestors',
    description: 'Screening in the park, bring a blanket.',
    categoryId: categories[0].id,
    venueId: venues[0].id,
    startsAt: '2026-10-17T19:00:00+03:00',
    endsAt: '2026-10-17T21:30:00+03:00',
    source: 'organization',
    status: 'published',
    organizationId: accounts.filmClub,
  },
  {
    id: 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e',
    title: 'Contemporary art exhibition at the Arsenal',
    description: 'Imported from a partner listing.',
    categoryId: categories[1].id,
    venueId: venues[1].id,
    startsAt: '2026-10-20T11:00:00+03:00',
    endsAt: '2026-10-20T23:59:59+03:00',
    source: 'import',
    status: 'published',
    organizationId: null,
  },
  {
    id: 'b8e5f1c3-2d4a-4c6b-9f0e-1a3d5c7b9e2f',
    title: 'Silent film with live piano',
    description: 'Cancelled: the pianist is ill.',
    categoryId: categories[0].id,
    venueId: venues[0].id,
    startsAt: '2026-10-24T18:00:00+03:00',
    endsAt: '2026-10-24T20:00:00+03:00',
    source: 'organization',
    status: 'cancelled',
    organizationId: accounts.filmClub,
  },
];

export const listings: Listing[] = [
  {
    id: '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09',
    authorId: accounts.olena,
    categoryId: categories[1].id,
    eventId: events[1].id,
    title: 'Looking for company for the Arsenal exhibition',
    description: 'Planning to go on Tuesday evening, happy to grab a coffee after.',
    date: '2026-10-20',
    status: 'active',
  },
  {
    id: 'af5b7d9e-1a3c-4e5f-9b7d-9e1a3c5e7f10',
    authorId: accounts.taras,
    categoryId: categories[2].id,
    eventId: null,
    title: 'Anyone up for a jazz concert this weekend?',
    description: 'No ticket yet, open to suggestions.',
    date: '2026-10-11',
    status: 'active',
  },
];
