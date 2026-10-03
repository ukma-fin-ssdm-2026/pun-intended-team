// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.js';
import { EventsRepository } from '../repositories/events.repository.js';
import type { Event } from '../types/event.js';

@Injectable()
export class EventsService {
  constructor(private readonly eventsRepository: EventsRepository) {}

  async getById(id: string): Promise<Event> {
    const event = await this.eventsRepository.findById(id);
    if (!event) {
      throw new DomainError('NOT_FOUND', 'Event not found');
    }
    return event;
  }
}
