// Written with the help of Claude
import type { Venue } from '../../catalog/types/venue.ts';

/** Finds the coordinates of a venue a provider gives without them (HLD I5). */
export abstract class Geocoder {
  /** The venue's coordinates, or undefined when it cannot be found. Throws when the service cannot be reached. */
  abstract locate(venue: Pick<Venue, 'name' | 'address'>): Promise<Venue['location'] | undefined>;
}
