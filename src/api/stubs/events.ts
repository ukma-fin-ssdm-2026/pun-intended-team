// Written with the help of Claude
import { type Event, eventExample } from '../schemas/events.js';

// Stub data until the database is connected.
export const events: Event[] = [
  eventExample,
  {
    id: 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e',
    title: 'Contemporary art exhibition at the Arsenal',
    description: 'Imported from a partner listing.',
    startsAt: '2026-10-20T11:00:00+03:00',
    endsAt: '2026-10-20T23:59:59+03:00',
    source: 'import',
    status: 'published',
  },
];
