// Written with the help of Claude
import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { PlaceLookup } from '../adapters/place-lookup.ts';
import type { PlaceDescription, Point } from '../types/place.ts';
import { requirePlaceInKyiv } from './place-area.ts';

/** Points closer than about a metre are one point: 5 decimal places of a degree. */
const PRECISION = 5;
const CACHE_SIZE = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * What is at a point of the place picker (Д2.1). The lookup service allows about one request a second, so recent
 * points are answered from memory, the ones where nothing was found too.
 */
@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private readonly cache = new Map<string, { found: PlaceDescription | undefined; at: number }>();

  constructor(private readonly placeLookup: PlaceLookup) {}

  /** NOT_FOUND when nothing is there; PLACE_LOOKUP_UNAVAILABLE when the lookup service cannot be reached. */
  async describe(point: Point, now = Date.now()): Promise<PlaceDescription> {
    requirePlaceInKyiv(point, 'lat');
    const rounded = { lat: round(point.lat), lng: round(point.lng) };
    const key = `${rounded.lat},${rounded.lng}`;
    const cached = this.cache.get(key);
    let found: PlaceDescription | undefined;
    if (cached && now - cached.at < CACHE_TTL_MS) {
      found = cached.found;
    } else {
      try {
        found = await this.placeLookup.describe(rounded);
      } catch (error) {
        this.logger.warn(`Place lookup failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new DomainError('PLACE_LOOKUP_UNAVAILABLE', 'The place lookup is unavailable; try again later');
      }
      this.remember(key, found, now);
    }
    if (!found) {
      throw new DomainError('NOT_FOUND', 'Nothing found at this point');
    }
    return found;
  }

  private remember(key: string, found: PlaceDescription | undefined, at: number): void {
    // A Map keeps insertion order: the first key is the oldest.
    this.cache.delete(key);
    this.cache.set(key, { found, at });
    if (this.cache.size > CACHE_SIZE) {
      const [oldest] = this.cache.keys();
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
  }
}

function round(degrees: number): number {
  return Number(degrees.toFixed(PRECISION));
}
