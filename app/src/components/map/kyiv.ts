// Written with the help of Claude
// The catalog's city. The map stays within it, so it never shows other regions (and their borders).
export type MapPoint = { lat: number; lng: number };

export const KYIV_CENTER: MapPoint = { lat: 50.4501, lng: 30.5234 };

export const KYIV_BOUNDS = { south: 50.21, west: 30.24, north: 50.59, east: 30.83 };

export function isInKyiv({ lat, lng }: MapPoint): boolean {
  return lat >= KYIV_BOUNDS.south && lat <= KYIV_BOUNDS.north && lng >= KYIV_BOUNDS.west && lng <= KYIV_BOUNDS.east;
}

/** The point moved inside the city, when it is outside. */
export function clampToKyiv({ lat, lng }: MapPoint): MapPoint {
  return {
    lat: Math.min(KYIV_BOUNDS.north, Math.max(KYIV_BOUNDS.south, lat)),
    lng: Math.min(KYIV_BOUNDS.east, Math.max(KYIV_BOUNDS.west, lng)),
  };
}
