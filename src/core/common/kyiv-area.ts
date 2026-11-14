// Written with the help of Claude
import type { Venue } from '../catalog/types/venue.ts';

/** Kyiv's bounding box: the geocoder searches only inside it, and the import trusts no provider point outside it. */
export const KYIV_AREA = { west: 30.2394, south: 50.2133, east: 30.8259, north: 50.5909 };

export function inKyiv({ lat, lng }: Venue['location']): boolean {
  return lat >= KYIV_AREA.south && lat <= KYIV_AREA.north && lng >= KYIV_AREA.west && lng <= KYIV_AREA.east;
}
