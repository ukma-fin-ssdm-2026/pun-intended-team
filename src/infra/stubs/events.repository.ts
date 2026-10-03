// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventsRepository } from '../../core/catalog/repositories/events.repository.js';
import type { Event } from '../../core/catalog/types/event.js';

// Stub data until the database is connected.
const events: Event[] = [
  {
    id: '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10',
    title: 'Open-air film night: Shadows of Forgotten Ancestors',
    description: 'Screening in the park, bring a blanket.',
    startsAt: '2026-10-17T19:00:00+03:00',
    endsAt: '2026-10-17T21:30:00+03:00',
    source: 'organization',
    status: 'published',
  },
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

@Injectable()
export class StubEventsRepository implements EventsRepository {
  async findById(id: string): Promise<Event | undefined> {
    return events.find((event) => event.id === id);
  }
}
