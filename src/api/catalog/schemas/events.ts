// Written with the help of Claude
import { z } from 'zod';
import { DateTime, Id } from '../../common/schemas/common.js';

export const EventSource = z
  .enum(['organization', 'import'])
  .meta({ id: 'EventSource', description: 'Who added the event: a verified organization or the importer' });

export const EventStatus = z.enum(['published', 'cancelled']).meta({ id: 'EventStatus' });

const EventFields = z.object({
  id: Id,
  title: z.string(),
  description: z.string(),
  startsAt: DateTime,
  endsAt: DateTime,
  source: EventSource,
  status: EventStatus,
});

export const eventExample: Event = {
  id: '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10',
  title: 'Open-air film night: Shadows of Forgotten Ancestors',
  description: 'Screening in the park, bring a blanket.',
  startsAt: '2026-10-17T19:00:00+03:00',
  endsAt: '2026-10-17T21:30:00+03:00',
  source: 'organization',
  status: 'published',
};

export const Event = EventFields.meta({
  id: 'Event',
  description: 'An event users can go to together',
  example: eventExample,
});

export const EventIdParams = z.object({
  id: Id.describe('Event id'),
});

export type Event = z.infer<typeof EventFields>;
