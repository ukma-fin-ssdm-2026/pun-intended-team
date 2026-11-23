// Written with the help of Claude
import type { OrganizationName } from './organization.ts';

/** `organization`: added by an organization, which owns it. `import`: created by the event import, no owner. */
export type VenueSource = 'organization' | 'import';

export interface Venue {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  source: VenueSource;
  /** The owning organization; set only for organization venues. */
  organizationId: string | null;
}

/** A venue as the admin panel shows it, with the organization that owns it. */
export interface VenueOverview extends Venue {
  organization: OrganizationName | null;
}

/** Which venues the admin panel lists; `search` matches part of the name or the address, in any case. */
export interface VenueSearch {
  search?: string;
  source?: VenueSource;
  organizationId?: string;
}

/** What an organization sends to add a venue. */
export type NewVenue = Pick<Venue, 'name' | 'address' | 'location'>;
