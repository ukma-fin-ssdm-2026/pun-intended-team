// Written with the help of Claude
import type { MapPoint } from './kyiv';

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
