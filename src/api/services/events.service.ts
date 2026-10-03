// Written with the help of Claude
import type { Event } from '../schemas/events.js';
import { events } from '../stubs/events.js';

export const eventsService = {
  async getById(id: string): Promise<Event | undefined> {
    return events.find((event) => event.id === id);
  },
};
