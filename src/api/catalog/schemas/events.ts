// Written with the help of Claude
import { z } from 'zod';
import {
  CalendarDate,
  DateTime,
  Id,
  PageQuery,
  pageExample,
  pageFields,
  pageOf,
  SearchText,
} from '../../common/schemas/common.ts';
import { EventPhoto, Image } from '../../images/schemas/images.ts';
import { ActiveCategoryId, Category, categoryExample } from './categories.ts';
import { OrganizationName } from './organizations.ts';

/** The highest ticket price an organization can enter, in hryvnias. */
export const MAX_PRICE = 1_000_000;

export const EventSource = z
  .enum(['organization', 'import'])
  .meta({ id: 'EventSource', description: 'Who added the event: a verified organization or the importer' });

export const EventStatus = z.enum(['published', 'cancelled']).meta({ id: 'EventStatus' });

const VenueFields = z.object({
  id: Id,
  name: z.string(),
  address: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
});

export const Venue = VenueFields.meta({ id: 'Venue', description: 'Where an event takes place' });

const VenueSource = z
  .enum(['organization', 'import'])
  .meta({ id: 'VenueSource', description: 'Who added the venue: an organization, which owns it, or the importer' });

const AdminVenueFields = VenueFields.extend({ source: VenueSource, organization: OrganizationName });

export const adminVenueExample: AdminVenue = {
  id: '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05',
  name: 'Natalka Park lawn',
  address: 'Naberezhno-Luhova St, Kyiv',
  location: { lat: 50.4825, lng: 30.5181 },
  source: 'organization',
  organization: { accountId: 'e1f3a5c7-9b2d-4f6e-8a0c-3d5f7b9e1a2c', name: 'Podil Film Club' },
};

export const AdminVenue = AdminVenueFields.meta({
  id: 'AdminVenue',
  description: 'A venue as administrators see it, with who added it',
  example: adminVenueExample,
});

export const EventOrganizer = z
  .object({
    id: Id.describe('Get its page with getOrganization'),
    name: z.string(),
    logo: Image.nullable().describe('A square shown as a circle; null shows the building icon'),
  })
  .meta({ id: 'EventOrganizer', description: 'The verified organization that published an event' });

const EventFields = z.object({
  id: Id,
  title: z.string(),
  description: z.string(),
  category: Category,
  venue: Venue,
  startsAt: DateTime,
  startTimeKnown: z
    .boolean()
    .describe(
      'False when the provider gives no time of day: startsAt is then a default opening time (12:00 Europe/Kyiv ' +
        'for exhibitions) that only orders the event and its sessions; show the dates without a time. Always true ' +
        'for an organization event',
    ),
  endsAt: DateTime,
  endTimeKnown: z
    .boolean()
    .describe(
      'False for an imported event whose provider gives no end: endsAt is then the end of its start day in ' +
        'Europe/Kyiv and only startsAt should be shown. Always true for an organization event',
    ),
  priceMin: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe(
      'The lowest ticket price in whole hryvnias. Null when the price is unknown: show no price. 0 with priceMax ' +
        'null or 0: the event is free',
    ),
  priceMax: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe(
      'The highest ticket price in whole hryvnias, when the tickets cost from priceMin to priceMax; never below ' +
        'priceMin. Null for one price, a free event or an unknown price',
    ),
  imageUrl: z
    .string()
    .nullable()
    .describe("Imported events: the provider's image URL, shown as is; null for organization events"),
  photo: EventPhoto.nullable().describe('The cover an organization uploaded; null for imported events and without one'),
  sourceUrl: z
    .string()
    .nullable()
    .describe("Imported events: the event's page at the provider, to credit it and to buy tickets; null otherwise"),
  source: EventSource,
  status: EventStatus,
  organizer: EventOrganizer.nullable().describe(
    'The organization that published the event, while it is verified; null for imported events',
  ),
});

export const eventExample: Event = {
  id: '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10',
  title: 'Open-air film night: Shadows of Forgotten Ancestors',
  description: 'Screening in the park, bring a blanket.',
  category: categoryExample,
  venue: {
    id: '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05',
    name: 'Natalka Park lawn',
    address: 'Naberezhno-Luhova St, Kyiv',
    location: { lat: 50.4825, lng: 30.5181 },
  },
  startsAt: '2026-10-17T19:00:00+03:00',
  startTimeKnown: true,
  endsAt: '2026-10-17T21:30:00+03:00',
  endTimeKnown: true,
  priceMin: 150,
  priceMax: null,
  imageUrl: null,
  photo: null,
  sourceUrl: null,
  source: 'organization',
  status: 'published',
  organizer: { id: 'e1f3a5c7-9b2d-4f6e-8a0c-3d5f7b9e1a2c', name: 'Podil Film Club', logo: null },
};

export const Event = EventFields.meta({
  id: 'Event',
  description: 'An event users can go to together',
  example: eventExample,
});

export const EventsPage = pageFields(Event)
  .extend({
    lastUpdatedAt: DateTime.nullable().describe(
      'Null while the imported events are current. While the latest import run of a provider failed, the catalog ' +
        'keeps serving the events of its last succeeded run, and this is when that run finished: the time of the ' +
        '"last updated" notice (FR-014). The same when the last succeeded run of a provider finished more than 30 ' +
        'hours ago, as when the import has stopped running. The same on every page and with every filter',
    ),
  })
  .meta({ id: 'EventsPage', example: { ...pageExample(eventExample), lastUpdatedAt: null } });

export const MyEventsPage = pageOf(Event, 'MyEventsPage', eventExample);

export const OrganizationEventsPage = pageOf(Event, 'OrganizationEventsPage', eventExample);

export const ListMyEventsQuery = PageQuery;

export const EventIdParams = z.object({
  id: Id.describe('Event id'),
});

const AdminEventFields = EventFields.extend({ organization: OrganizationName });

const adminEventExample: AdminEvent = { ...eventExample, organization: adminVenueExample.organization };

export const AdminEvent = AdminEventFields.meta({
  id: 'AdminEvent',
  description: 'An event as administrators see it: in any status, past or upcoming, with who added it',
  example: adminEventExample,
});

export const AdminEventsPage = pageOf(AdminEvent, 'AdminEventsPage', adminEventExample);

export const ListAdminEventsQuery = PageQuery.extend({
  period: z
    .enum(['upcoming', 'past'])
    .default('upcoming')
    .describe('`upcoming`: not ended yet, soonest first. `past`: ended, latest first'),
  search: SearchText.optional().describe('Part of the title, in any case'),
  source: EventSource.optional(),
  status: EventStatus.optional(),
  organizationId: Id.optional().describe('Only events of this organization, by its account id'),
  venueId: Id.optional().describe('Only events at this venue'),
  categoryId: Id.optional().describe('Only events of this category, active or not'),
});

/** How many categories one catalog request can name. */
export const MAX_CATEGORY_IDS = 20;

/** The largest radius of the distance filter: Kyiv is about 40 km across. */
export const MAX_RADIUS_KM = 50;

// The query parser gives a repeated parameter as an array and a single one as a string, which may hold a list.
const CategoryIds = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',') : value),
  z.array(Id).min(1).max(MAX_CATEGORY_IDS),
);

export const ListEventsQuery = PageQuery.extend({
  categoryIds: CategoryIds.optional().describe(
    `Only events of any of these categories, at most ${MAX_CATEGORY_IDS}: repeated ` +
      '(`categoryIds=a&categoryIds=b`) or comma-separated (`categoryIds=a,b`). An unknown id matches no event',
  ),
  venueId: Id.optional().describe('Only events at this venue, e.g. after tapping its map pin'),
  lat: z.coerce.number().min(-90).max(90).optional().describe('Latitude of the point; only with lng and radiusKm'),
  lng: z.coerce.number().min(-180).max(180).optional().describe('Longitude of the point; only with lat and radiusKm'),
  radiusKm: z.coerce
    .number()
    .positive()
    .max(MAX_RADIUS_KM)
    .optional()
    .describe(`Only events whose venue is within this many kilometres of lat, lng; at most ${MAX_RADIUS_KM}`),
  from: CalendarDate.optional().describe('First day, Kyiv time; earlier dates count as today'),
  to: CalendarDate.optional().describe('Last day, Kyiv time; later dates count as the end of the catalog window'),
})
  .refine(({ from, to }) => !from || !to || from <= to, { path: ['to'], message: 'Must not be before from' })
  .superRefine(({ lat, lng, radiusKm }, context) => {
    const missing = Object.entries({ lat, lng, radiusKm }).filter(([, value]) => value === undefined);
    if (missing.length === 3) return;
    for (const [field] of missing) {
      context.addIssue({ code: 'custom', path: [field], message: 'lat, lng and radiusKm go together' });
    }
  });

/** A ticket price in whole hryvnias; the upper bound only keeps a typo from passing as a price. */
const Hryvnias = z.number().int().min(0).max(MAX_PRICE);

const EventInputFields = {
  title: z.string().trim().min(1).max(120).describe('Title shown in the catalog'),
  description: z.string().trim().max(5000).describe('Can be empty'),
  categoryId: ActiveCategoryId,
  venueId: Id.describe("One of the organization's own venues"),
  startsAt: DateTime.describe('Start time with an offset, e.g. 2026-10-25T19:00:00+03:00'),
  endsAt: DateTime.describe('End time with an offset; must be after startsAt'),
  priceMin: Hryvnias.nullable()
    .default(null)
    .describe('The lowest ticket price in whole hryvnias; 0 for a free event. Omitted or null: the price is unknown'),
  priceMax: Hryvnias.nullable()
    .default(null)
    .describe(
      'The highest ticket price of a range in whole hryvnias; only together with priceMin, and not below it. ' +
        'Omitted or null for one price or a free event',
    ),
};

// PUT replaces every editable field, so a price left out of an edit becomes unknown.
const CreateEventFields = z
  .strictObject(EventInputFields)
  .refine(({ priceMin, priceMax }) => priceMax === null || priceMin !== null, {
    path: ['priceMax'],
    message: 'Requires priceMin',
  })
  .refine(({ priceMin, priceMax }) => priceMin === null || priceMax === null || priceMax >= priceMin, {
    path: ['priceMax'],
    message: 'Must not be below priceMin',
  });

export const createEventExample: CreateEventBody = {
  title: 'Film quiz night',
  description: 'Teams of up to four, questions on Ukrainian cinema.',
  categoryId: categoryExample.id,
  venueId: eventExample.venue.id,
  startsAt: '2026-10-25T19:00:00+03:00',
  endsAt: '2026-10-25T21:00:00+03:00',
  priceMin: 300,
  priceMax: 700,
};

export const CreateEventBody = CreateEventFields.meta({
  id: 'CreateEventBody',
  description: 'All editable fields of an event; PUT /events/{id} takes the same body',
  example: createEventExample,
});

export type Venue = z.infer<typeof VenueFields>;
export type Event = z.infer<typeof EventFields>;
export type CreateEventBody = z.input<typeof CreateEventFields>;
export type EventsPage = z.infer<typeof EventsPage>;
export type MyEventsPage = z.infer<typeof MyEventsPage>;
export type OrganizationEventsPage = z.infer<typeof OrganizationEventsPage>;
export type AdminVenue = z.infer<typeof AdminVenueFields>;
export type AdminEvent = z.infer<typeof AdminEventFields>;
export type AdminEventsPage = z.infer<typeof AdminEventsPage>;
