// Written with the help of Claude
import { z } from 'zod';
import { CalendarDate, Id, PageQuery, pageOf } from '../../common/schemas/common.ts';
import { CoverImage, Image } from '../../images/schemas/images.ts';
import { Interest, interestExample } from '../../profiles/schemas/profiles.ts';
import { ListingPlace, ListingRequestStatus, listingExample } from './listings.ts';

const ListingRequestPerson = z
  .object({
    username: z.string(),
    displayName: z.string(),
    description: z.string(),
    occupation: z.string(),
    age: z.number().int().describe('Whole years'),
    interests: z.array(Interest),
    photo: Image.nullable().describe('The avatar; null shows the initial'),
    cover: CoverImage.nullable().describe('null shows the default gradient'),
  })
  .meta({
    id: 'ListingRequestPerson',
    description: 'A public profile, as a match partner sees it; never contacts (FR-019)',
  });

const ListingRequestListing = z
  .object({
    id: Id,
    title: z.string(),
    date: CalendarDate,
    place: ListingPlace.nullable(),
    eventId: Id.nullable().describe('The catalog event the listing is about, if any'),
  })
  .meta({ id: 'ListingRequestListing', description: 'The listing a request is about' });

const ListingRequestFields = z.object({
  id: Id,
  status: ListingRequestStatus,
  role: z
    .enum(['author', 'requester'])
    .describe('The caller’s side: the listing’s author, or the user who asked to join it'),
  createdAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable().describe('When the author answered; null while pending'),
  listing: ListingRequestListing,
  requester: ListingRequestPerson.describe('Who asked to join'),
  author: ListingRequestPerson.describe('Who posted the listing'),
});

const person = {
  username: 'taras_m',
  displayName: 'Тарас',
  description: 'Exhibitions and long walks.',
  occupation: 'Designer',
  age: 25,
  interests: [interestExample],
  photo: null,
  cover: null,
};

export const listingRequestExample: ListingRequest = {
  id: '3b5d7f9a-1c2e-4a6b-8d0f-2a4c6e8b0d13',
  status: 'pending',
  role: 'author',
  createdAt: '2026-10-15T12:00:00.000Z',
  decidedAt: null,
  listing: {
    id: listingExample.id,
    title: listingExample.title,
    date: listingExample.date,
    place: listingExample.place,
    eventId: listingExample.eventId,
  },
  requester: person,
  author: { ...person, username: 'olena_k', displayName: 'Olena', age: 24 },
};

export const ListingRequest = ListingRequestFields.meta({
  id: 'ListingRequest',
  description: 'A user’s request to join a listing, as its author or the requester sees it',
  example: listingRequestExample,
});

export const ListingRequestsPage = pageOf(ListingRequest, 'ListingRequestsPage', listingRequestExample);

export const ListingRequestIdParams = z.object({
  id: Id.describe('Listing request id'),
});

export const ListListingRequestsQuery = PageQuery;

export type ListingRequest = z.infer<typeof ListingRequestFields>;
export type ListingRequestsPage = z.infer<typeof ListingRequestsPage>;
