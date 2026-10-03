// Written with the help of Claude
import { z } from 'zod';
import { Category, categoryExample } from '../../catalog/schemas/categories.js';
import { CalendarDate, Id, PageQuery, pageOf } from '../../common/schemas/common.js';

export const ListingStatus = z.enum(['active', 'removed']).meta({ id: 'ListingStatus' });

const ListingAuthor = z
  .object({ username: z.string(), displayName: z.string() })
  .meta({ id: 'ListingAuthor', description: 'Who posted the listing; never their contacts' });

const ListingFields = z.object({
  id: Id,
  author: ListingAuthor,
  category: Category,
  eventId: Id.nullable().describe('The catalog event the listing is about, if any'),
  title: z.string(),
  description: z.string(),
  date: CalendarDate,
  status: ListingStatus,
});

export const listingExample: Listing = {
  id: '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09',
  author: { username: 'olena_k', displayName: 'Olena' },
  category: categoryExample,
  eventId: null,
  title: 'Looking for company for an exhibition on Saturday',
  description: 'Planning to go in the evening, happy to grab a coffee after.',
  date: '2026-10-17',
  status: 'active',
};

export const Listing = ListingFields.meta({
  id: 'Listing',
  description: 'A "looking for company" post',
  example: listingExample,
});

export const ListingsPage = pageOf(Listing, 'ListingsPage');

export const ListingIdParams = z.object({
  id: Id.describe('Listing id'),
});

export const ListListingsQuery = PageQuery;

export const CreateListingBody = z
  .object({
    categoryId: Id,
    eventId: Id.optional().describe('A catalog event the listing is about'),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000),
    date: CalendarDate.describe('The day, Kyiv time'),
  })
  .meta({ id: 'CreateListingBody' });

export type Listing = z.infer<typeof ListingFields>;
export type ListingsPage = z.infer<typeof ListingsPage>;
