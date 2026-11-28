// Written with the help of Claude
import { DomainError } from '../../common/domain-error.ts';
import { inKyiv } from '../../common/kyiv-area.ts';
import type { Point } from '../types/place.ts';

/** A listing's place is in Kyiv, as the catalog's venues are. */
export function requirePlaceInKyiv(point: Point, field: string): void {
  if (!inKyiv(point)) {
    throw new DomainError('PLACE_OUTSIDE_CITY', 'The place must be in Kyiv', field);
  }
}
