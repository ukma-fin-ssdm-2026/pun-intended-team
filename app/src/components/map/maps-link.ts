// Written with the help of Claude
import type { MapPoint } from './kyiv';

// The point in the phone's own maps: Apple Maps on iOS, Google Maps on Android and on the web.
export function mapsLink({ lat, lng }: MapPoint, os: string): string {
  const query = `${lat},${lng}`;
  return os === 'ios'
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}
