// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type { NewVenue, Venue, VenueOverview, VenueSearch } from '../types/venue.ts';

export abstract class VenuesRepository {
  abstract findById(id: string): Promise<Venue | undefined>;

  /** The organization's own venues, by name. */
  abstract findByOrganization(organizationId: string, page: PageRequest): Promise<Page<Venue>>;

  /** Every venue that matches, by name. */
  abstract search(filter: VenueSearch, page: PageRequest): Promise<Page<VenueOverview>>;

  abstract findOverview(id: string): Promise<VenueOverview | undefined>;

  abstract create(organizationId: string, venue: NewVenue): Promise<Venue>;
}
