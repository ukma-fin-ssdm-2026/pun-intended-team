// Written with the help of Claude
import type { Venue } from '../types/venue.ts';

export abstract class VenuesRepository {
  abstract findById(id: string): Promise<Venue | undefined>;
}
