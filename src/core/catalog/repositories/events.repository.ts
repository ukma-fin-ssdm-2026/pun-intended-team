// Written with the help of Claude
import type { Event } from '../types/event.js';

/**
 * What the catalog needs from storage. Core only depends on this class;
 * InfraModule decides which implementation services get.
 */
export abstract class EventsRepository {
  abstract findById(id: string): Promise<Event | undefined>;
}
