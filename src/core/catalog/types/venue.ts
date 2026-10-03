// Written with the help of Claude
export interface Venue {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  organizationId: string | null;
}
