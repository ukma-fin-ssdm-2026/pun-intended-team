// Written with the help of Claude
import { isInKyiv, type MapPoint } from './kyiv';

export type VenuePin = { id: string; location: MapPoint; count: number; name: string };

export type VenueMapProps = {
  pins: VenuePin[];
  selectedId?: string;
  /** The user's location: the map moves to it once it is known; without it the map shows the whole city. */
  user?: MapPoint;
  onPinPress: (id: string) => void;
};

// Figma "Т1 Мапа": pins are ink circles with the number of events, the selected one coral, with a white 3 px border.
export const PIN_SIZE = 36;
export const SELECTED_PIN_SIZE = 44;

// The venue card covers about this much of the map's bottom; a selected pin is moved into the part above it.
export const VENUE_CARD_HEIGHT = 380;

/**
 * Where the map moves: to the selected pin, and to the user once the location is known and in the city. Plain numbers,
 * so the map's effects run only when a point really changes.
 */
export function mapTargets({ pins, selectedId, user }: Pick<VenueMapProps, 'pins' | 'selectedId' | 'user'>) {
  const selected = pins.find((pin) => pin.id === selectedId)?.location;
  const located = user && isInKyiv(user) ? user : undefined;
  return { selectedLat: selected?.lat, selectedLng: selected?.lng, userLat: located?.lat, userLng: located?.lng };
}
