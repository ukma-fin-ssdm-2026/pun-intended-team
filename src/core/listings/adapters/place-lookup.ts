// Written with the help of Claude
import type { PlaceDescription, Point } from '../types/place.ts';

/** Says what is at a point on the map (HLD I5), for the place picker of a listing. */
export abstract class PlaceLookup {
  /** What is at the point, or undefined when nothing is found there. Throws when the service cannot be reached. */
  abstract describe(point: Point): Promise<PlaceDescription | undefined>;
}
