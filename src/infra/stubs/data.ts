// Written with the help of Claude
// In-memory data of the import's stub repository, until #289 moves the import to the database.
// The catalog reads from the database; only the import's unit test still reads these arrays.
import { addDays, kyivDate } from '../../core/common/kyiv-time.ts';
import type { Event } from '../../core/catalog/types/event.ts';
import type { Venue } from '../../core/catalog/types/venue.ts';

// The organizations' accounts are in the database; the stubs refer to them by these ids.
export const accounts = {
  filmClub: 'e1f3a5c7-9b2d-4f6e-8a0c-3d5f7b9e1a2c',
  newGallery: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
} as const;

// Seeded by the seed_categories migration; the categories themselves live in the database.
const categoryIds = {
  exhibitions: '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02',
  concerts: '2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03',
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

export const venues: Venue[] = [
  {
    id: venueIds.natalkaPark,
    name: 'Natalka Park lawn',
    address: 'Naberezhno-Luhova St, Kyiv',
    location: { lat: 50.4825, lng: 30.5181 },
    source: 'organization',
    organizationId: accounts.filmClub,
  },
  {
    id: venueIds.arsenal,
    name: 'Mystetskyi Arsenal',
    address: '10-12 Lavrska St, Kyiv',
    location: { lat: 50.4357, lng: 30.5555 },
    source: 'import',
    organizationId: null,
  },
  {
    id: venueIds.newGalleryHall,
    name: 'New Gallery hall',
    address: '5 Velyka Vasylkivska St, Kyiv',
    location: { lat: 50.4401, lng: 30.5203 },
    source: 'organization',
    organizationId: accounts.newGallery,
  },
];

// Dates count from the day the server starts, so the stub catalog never runs out.
const inDays = (days: number) => addDays(kyivDate(), days);

/** How an event row is stored: category and venue by id, joined on read. */
export type StoredEvent = Omit<Event, 'category' | 'venue'> & {
  categoryId: string;
  venueId: string;
  /** Set on imported events: the provider and its id for the record. */
  provider?: string;
  externalId?: string;
};

export const events: StoredEvent[] = [
  {
    id: eventIds.filmNight,
    title: 'Open-air film night: Shadows of Forgotten Ancestors',
    description: 'Screening in the park, bring a blanket.',
    categoryId: categoryIds.concerts,
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
    categoryId: categoryIds.concerts,
    venueId: venueIds.natalkaPark,
    startsAt: `${inDays(20)}T18:00:00+03:00`,
    endsAt: `${inDays(20)}T20:00:00+03:00`,
    source: 'organization',
    status: 'cancelled',
    organizationId: accounts.filmClub,
  },
];
