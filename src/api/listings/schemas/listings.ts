// Written with the help of Claude
import { z } from 'zod';
import { ActiveCategoryId, Category } from '../../catalog/schemas/categories.ts';
import { CalendarDate, Id, PageQuery, pageOf } from '../../common/schemas/common.ts';
import { Image } from '../../images/schemas/images.ts';

export const ListingStatus = z.enum(['active', 'removed']).meta({ id: 'ListingStatus' });

export const ListingRequestStatus = z.enum(['pending', 'accepted', 'declined']).meta({
  id: 'ListingRequestStatus',
  description:
    '`pending`: waiting for the author. `accepted`: the author accepted, both see each other’s contacts. ' +
    '`declined`: the author declined; the requester gets no notification, and the app keeps showing the ' +
    'request as sent',
});

const OwnListingRequest = z
  .object({ id: Id, status: ListingRequestStatus })
  .meta({ id: 'OwnListingRequest', description: 'The caller’s request to join a listing' });

const ListingAuthor = z
  .object({ username: z.string(), displayName: z.string(), photo: Image.nullable() })
  .meta({ id: 'ListingAuthor', description: 'Who posted the listing; never their contacts' });

export const Point = z
  .object({
    lat: z.number().min(-90).max(90).describe('Latitude, WGS 84'),
    lng: z.number().min(-180).max(180).describe('Longitude, WGS 84'),
  })
  .meta({ id: 'Point', description: 'A point on the map' });

const ListingPlaceFields = z.object({
  name: z.string().describe('The place or the building, else the street and the house'),
  address: z.string().describe('Street, house and district; may be empty'),
  location: Point,
});

export const ListingPlace = ListingPlaceFields.meta({
  id: 'ListingPlace',
  description: 'Where the author suggests meeting, picked on the map; not a catalog venue',
});

const LikeCount = z.number().int().min(0).describe('How many users like the listing, its author included');
const Liked = z.boolean().describe('Whether the caller likes the listing');

const ListingFields = z.object({
  id: Id,
  author: ListingAuthor,
  category: Category,
  eventId: Id.nullable().describe('The catalog event the listing is about, if any'),
  title: z.string(),
  description: z.string(),
  date: CalendarDate,
  status: ListingStatus,
  photo: Image.nullable().describe('Cut to 2:1, as the post card shows it'),
  place: ListingPlace.nullable().describe('Null when the listing names no place'),
  myRequest: OwnListingRequest.nullable().describe(
    'The caller’s own request to join this listing; null without one, and always on the caller’s own listing',
  ),
  likeCount: LikeCount,
  liked: Liked,
});

export const listingExample: Listing = {
  id: '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09',
  author: { username: 'olena_k', displayName: 'Olena', photo: null },
  category: { id: '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02', name: 'Виставки' },
  eventId: null,
  title: 'Looking for company for an exhibition on Saturday',
  description: 'Planning to go in the evening, happy to grab a coffee after.',
  date: '2026-10-17',
  status: 'active',
  photo: null,
  place: {
    name: 'Мистецький Арсенал',
    address: 'вулиця Лаврська, 10-12, Печерський район',
    location: { lat: 50.4357, lng: 30.5555 },
  },
  myRequest: null,
  likeCount: 3,
  liked: true,
};

export const Listing = ListingFields.meta({
  id: 'Listing',
  description: 'A "looking for company" post',
  example: listingExample,
});

const ListingLikesFields = z.object({ likeCount: LikeCount, liked: Liked });

export const ListingLikes = ListingLikesFields.meta({
  id: 'ListingLikes',
  description: 'The likes of a listing after the caller’s like or unlike',
  example: { likeCount: 3, liked: true },
});

export const ListingsPage = pageOf(Listing, 'ListingsPage', listingExample);

export const ListingIdParams = z.object({
  id: Id.describe('Listing id'),
});

export const ListListingsQuery = PageQuery;

const CreateListingFields = z.strictObject({
  categoryId: ActiveCategoryId,
  eventId: Id.optional().describe('A catalog event the listing is about'),
  title: z.string().trim().min(1).max(120).describe('Title shown in the listing feed'),
  description: z.string().trim().max(2000).describe('Can be empty'),
  date: CalendarDate.describe('The day, Kyiv time; today or later'),
  place: z
    .strictObject({
      name: z.string().trim().min(1).max(100).describe('What the place is called, e.g. from reversePlace'),
      address: z.string().trim().max(200).describe('May be empty'),
      location: Point.describe('Must be in Kyiv; otherwise PLACE_OUTSIDE_CITY'),
    })
    .optional()
    .describe('Where to meet, picked on the map; all of name, address and location, or omitted'),
});

export const createListingExample: CreateListingBody = {
  categoryId: '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02',
  eventId: 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e',
  title: 'Looking for company for the Arsenal exhibition',
  description: 'Planning to go in the evening, happy to grab a coffee after.',
  date: '2026-10-20',
  place: listingExample.place ?? undefined,
};

export const CreateListingBody = CreateListingFields.meta({ id: 'CreateListingBody', example: createListingExample });

export const ReversePlaceQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).describe('Latitude of the map centre'),
  lng: z.coerce.number().min(-180).max(180).describe('Longitude of the map centre'),
});

const PlaceDescriptionFields = z.object({
  name: z.string().describe('The place or the building there, else the street and the house'),
  address: z.string().describe('Street, house and district; may be empty'),
});

export const PlaceDescription = PlaceDescriptionFields.meta({
  id: 'PlaceDescription',
  description: 'What is at a point on the map, from OpenStreetMap (© OpenStreetMap contributors, ODbL)',
  example: { name: 'Мистецький Арсенал', address: 'вулиця Лаврська, 10-12, Печерський район' },
});

export type Listing = z.infer<typeof ListingFields>;
export type PlaceDescription = z.infer<typeof PlaceDescriptionFields>;
export type ListingsPage = z.infer<typeof ListingsPage>;
export type ListingLikes = z.infer<typeof ListingLikesFields>;
export type CreateListingBody = z.input<typeof CreateListingFields>;
