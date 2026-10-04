// Written with the help of Claude
import { z } from 'zod';
import { ActiveCategoryId, Category, categoryExample } from '../../catalog/schemas/categories.js';
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
});

export const createListingExample: CreateListingBody = {
  categoryId: '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02',
  eventId: 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e',
  title: 'Looking for company for the Arsenal exhibition',
  description: 'Planning to go in the evening, happy to grab a coffee after.',
  date: '2026-10-20',
};

export const CreateListingBody = CreateListingFields.meta({ id: 'CreateListingBody', example: createListingExample });

export type Listing = z.infer<typeof ListingFields>;
export type ListingsPage = z.infer<typeof ListingsPage>;
export type CreateListingBody = z.input<typeof CreateListingFields>;
