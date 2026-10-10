// Written with the help of Claude
// Stub data until the database is connected. Kept in memory: changes made
// through the API last until the server restarts.
import { addDays, kyivDate } from '../../core/common/kyiv-time.ts';
import type { Account } from '../../core/identity/types/account.ts';
import type { Caller } from '../../core/identity/types/caller.ts';
import type { VerificationCode } from '../../core/identity/types/verification-code.ts';
import type { Event } from '../../core/catalog/types/event.ts';
import type { Category } from '../../core/catalog/types/category.ts';
import type { Organization } from '../../core/catalog/types/organization.ts';
import type { Venue } from '../../core/catalog/types/venue.ts';
import type { Listing } from '../../core/listings/types/listing.ts';
import type { ProfileSummary } from '../../core/profiles/types/profile.ts';

export const accounts = {
  olena: 'c3a1f6d2-4b7e-4f0a-9d21-6e8b5a3c7f14',
  taras: 'd8e2b4c6-1a3f-4e5d-8b7c-9f0a2c4e6b18',
  filmClub: 'e1f3a5c7-9b2d-4f6e-8a0c-3d5f7b9e1a2c',
  newGallery: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
  admin: 'a0c2e4f6-8b1d-4a3c-9e5f-7b9d1f3a5c6e',
} as const;

export type StoredAccount = Account & { passwordHash: string | null };

/** Every seeded account signs in with the password `nearby-dev-password`. */
export const storedAccounts: StoredAccount[] = [
  {
    id: accounts.olena,
    phone: '+380501110001',
    role: 'user',
    status: 'active',
    dateOfBirth: '2001-04-12',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$LnG7K0R7BJ6TF1NOl/kiUA$OobkKSuS8xyXPey6bgtmsmsDwx3BMrZ/rUXrfCqlIAM',
  },
  {
    id: accounts.taras,
    phone: '+380501110002',
    role: 'user',
    status: 'active',
    dateOfBirth: '1998-11-03',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$oYWbgSv7qBSiEAktpWqTKw$7MS6NJ8lW91UtWCr1Th15mBnCNh7wF1lC0l/o3qWO9I',
  },
  {
    id: accounts.filmClub,
    phone: '+380501110003',
    role: 'user',
    status: 'active',
    dateOfBirth: '1990-06-21',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$mbsR20JBtHrDaHifqHOiPg$rtm+NwVRQqNJrn0W7iwtXK4qWmp+scuJjig6IDoWW2c',
  },
  {
    id: accounts.newGallery,
    phone: '+380501110004',
    role: 'user',
    status: 'active',
    dateOfBirth: '1995-02-08',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$DYsNhEfFW/Et/WHp53hi3A$9dMgfT/ns9lcZkWOrCnjCnIX8Ko/Bej6VWdMvojgjQQ',
  },
  {
    id: accounts.admin,
    phone: '+380501110005',
    role: 'admin',
    status: 'active',
    dateOfBirth: '1988-09-15',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$q/i5tKWroyaTrMl2KrIbqw$p3fWgp18FPlZRLMH11s+ska1YYY3M8i1Sm1pPsqQTaw',
  },
];

export const verificationCodes: VerificationCode[] = [];

/** Demo tokens for Swagger UI and curl, until sign-in is implemented. */
export const sessions: Record<string, Caller> = {
  'stub-guest': { kind: 'guest', guestId: 'stub-guest' },
  'stub-user': { kind: 'account', accountId: accounts.olena, role: 'user', sessionId: 'stub-user' },
  'stub-user-2': { kind: 'account', accountId: accounts.taras, role: 'user', sessionId: 'stub-user-2' },
  'stub-org': { kind: 'account', accountId: accounts.filmClub, role: 'user', sessionId: 'stub-org' },
  'stub-org-pending': { kind: 'account', accountId: accounts.newGallery, role: 'user', sessionId: 'stub-org-pending' },
  'stub-admin': { kind: 'account', accountId: accounts.admin, role: 'admin', sessionId: 'stub-admin' },
};

export const profiles: ProfileSummary[] = [
  { accountId: accounts.olena, username: 'olena_k', displayName: 'Olena' },
  { accountId: accounts.taras, username: 'taras.m', displayName: 'Taras' },
];

export const organizations: Organization[] = [
  { accountId: accounts.filmClub, name: 'Podil Film Club', verificationStatus: 'verified' },
  { accountId: accounts.newGallery, name: 'New Gallery', verificationStatus: 'pending' },
];

const categoryIds = {
  cinema: '0b6f2d4a-8c1e-4a3b-9d5f-7e2a4c6b8d01',
  exhibitions: '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02',
  concerts: '2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03',
  poetrySlams: '3e9c5a7d-1f4b-4d6e-8a8c-0b5d7f9e1a04',
} as const;

const venueIds = {
  natalkaPark: '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05',
  arsenal: '6b2d4f6a-8c0e-4a2b-9d4f-6a8b0c2e4f06',
  newGalleryHall: '7c3e5a7b-9d1f-4b3c-8e5a-7b9c1d3f5a07',
} as const;

const eventIds = {
  filmNight: '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10',
  arsenalExhibition: 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e',
  silentFilm: 'b8e5f1c3-2d4a-4c6b-9f0e-1a3d5c7b9e2f',
} as const;

export const categories: Category[] = [
  { id: categoryIds.cinema, name: 'Cinema', isActive: true },
  { id: categoryIds.exhibitions, name: 'Exhibitions', isActive: true },
  { id: categoryIds.concerts, name: 'Concerts', isActive: true },
  { id: categoryIds.poetrySlams, name: 'Poetry slams', isActive: false },
];

export const venues: Venue[] = [
  {
    id: venueIds.natalkaPark,
    name: 'Natalka Park lawn',
    address: 'Naberezhno-Luhova St, Kyiv',
    location: { lat: 50.4825, lng: 30.5181 },
    organizationId: accounts.filmClub,
  },
  {
    id: venueIds.arsenal,
    name: 'Mystetskyi Arsenal',
    address: '10-12 Lavrska St, Kyiv',
    location: { lat: 50.4357, lng: 30.5555 },
    organizationId: null,
  },
  {
    id: venueIds.newGalleryHall,
    name: 'New Gallery hall',
    address: '5 Velyka Vasylkivska St, Kyiv',
    location: { lat: 50.4401, lng: 30.5203 },
    organizationId: accounts.newGallery,
  },
];

// Dates count from the day the server starts, so the stub catalog never runs out.
const inDays = (days: number) => addDays(kyivDate(), days);

/** How an event row is stored: category and venue by id, joined on read. */
export type StoredEvent = Omit<Event, 'category' | 'venue'> & { categoryId: string; venueId: string };

export const events: StoredEvent[] = [
  {
    id: eventIds.filmNight,
    title: 'Open-air film night: Shadows of Forgotten Ancestors',
    description: 'Screening in the park, bring a blanket.',
    categoryId: categoryIds.cinema,
    venueId: venueIds.natalkaPark,
    startsAt: `${inDays(13)}T19:00:00+03:00`,
    endsAt: `${inDays(13)}T21:30:00+03:00`,
    source: 'organization',
    status: 'published',
    organizationId: accounts.filmClub,
  },
  {
    id: eventIds.arsenalExhibition,
    title: 'Contemporary art exhibition at the Arsenal',
    description: 'Imported from a partner listing.',
    categoryId: categoryIds.exhibitions,
    venueId: venueIds.arsenal,
    startsAt: `${inDays(16)}T11:00:00+03:00`,
    endsAt: `${inDays(16)}T23:59:59+03:00`,
    source: 'import',
    status: 'published',
    organizationId: null,
  },
  {
    id: eventIds.silentFilm,
    title: 'Silent film with live piano',
    description: 'Cancelled: the pianist is ill.',
    categoryId: categoryIds.cinema,
    venueId: venueIds.natalkaPark,
    startsAt: `${inDays(20)}T18:00:00+03:00`,
    endsAt: `${inDays(20)}T20:00:00+03:00`,
    source: 'organization',
    status: 'cancelled',
    organizationId: accounts.filmClub,
  },
];

export const listings: Listing[] = [
  {
    id: '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09',
    authorId: accounts.olena,
    categoryId: categoryIds.exhibitions,
    eventId: eventIds.arsenalExhibition,
    title: 'Looking for company for the Arsenal exhibition',
    description: 'Planning to go in the evening, happy to grab a coffee after.',
    date: inDays(16),
    status: 'active',
  },
  {
    id: 'af5b7d9e-1a3c-4e5f-9b7d-9e1a3c5e7f10',
    authorId: accounts.taras,
    categoryId: categoryIds.concerts,
    eventId: null,
    title: 'Anyone up for a jazz concert?',
    description: 'No ticket yet, open to suggestions.',
    date: inDays(7),
    status: 'active',
  },
];
