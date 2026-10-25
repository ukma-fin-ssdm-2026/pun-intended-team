// Written with the help of Claude
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
