// Written with the help of Claude
import type { NewImportedVenue, Venue } from '../types/venue.ts';

export abstract class VenuesRepository {
  abstract findById(id: string): Promise<Venue | undefined>;

  /** A venue the import created earlier (no organization), found by its name and address. */
  abstract findImported(name: string, address: string): Promise<Venue | undefined>;

  abstract createImported(venue: NewImportedVenue): Promise<Venue>;
}
