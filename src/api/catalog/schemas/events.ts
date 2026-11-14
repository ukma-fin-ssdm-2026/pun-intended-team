// Written with the help of Claude
import { z } from 'zod';
import { CalendarDate, DateTime, Id, PageQuery, pageExample, pageFields } from '../../common/schemas/common.ts';
import { ActiveCategoryId, Category, categoryExample } from './categories.ts';

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

const EventFields = z.object({
  id: Id,
  title: z.string(),
  description: z.string(),
  category: Category,
  venue: Venue,
  startsAt: DateTime,
  endsAt: DateTime,
  imageUrl: z
    .string()
    .nullable()
    .describe("Imported events: the provider's image URL, shown as is; null for organization events"),
  sourceUrl: z
    .string()
    .nullable()
    .describe("Imported events: the event's page at the provider, to credit it and to buy tickets; null otherwise"),
  source: EventSource,
  status: EventStatus,
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
  endsAt: '2026-10-17T21:30:00+03:00',
  imageUrl: null,
  sourceUrl: null,
  source: 'organization',
  status: 'published',
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
        '"last updated" notice (FR-014). The same on every page and with every filter',
    ),
  })
  .meta({ id: 'EventsPage', example: { ...pageExample(eventExample), lastUpdatedAt: null } });

export const EventIdParams = z.object({
  id: Id.describe('Event id'),
});

export const ListEventsQuery = PageQuery.extend({
  categoryId: Id.optional().describe('Only events of this category'),
  venueId: Id.optional().describe('Only events at this venue, e.g. after tapping its map pin'),
  from: CalendarDate.optional().describe('First day, Kyiv time; earlier dates count as today'),
  to: CalendarDate.optional().describe('Last day, Kyiv time; later dates count as the end of the catalog window'),
}).refine(({ from, to }) => !from || !to || from <= to, { path: ['to'], message: 'Must not be before from' });

const EventInputFields = {
  title: z.string().trim().min(1).max(120).describe('Title shown in the catalog'),
  description: z.string().trim().max(5000).describe('Can be empty'),
  categoryId: ActiveCategoryId,
  venueId: Id.describe("One of the organization's own venues"),
  startsAt: DateTime.describe('Start time with an offset, e.g. 2026-10-25T19:00:00+03:00'),
  endsAt: DateTime.describe('End time with an offset; must be after startsAt'),
};

const CreateEventFields = z.strictObject(EventInputFields);

export const createEventExample: CreateEventBody = {
  title: 'Film quiz night',
  description: 'Teams of up to four, questions on Ukrainian cinema.',
  categoryId: categoryExample.id,
  venueId: eventExample.venue.id,
  startsAt: '2026-10-25T19:00:00+03:00',
  endsAt: '2026-10-25T21:00:00+03:00',
};

export const CreateEventBody = CreateEventFields.meta({
  id: 'CreateEventBody',
  description: 'All editable fields of an event; PUT /events/{id} takes the same body',
  example: createEventExample,
});

export type Event = z.infer<typeof EventFields>;
export type CreateEventBody = z.input<typeof CreateEventFields>;
export type EventsPage = z.infer<typeof EventsPage>;
