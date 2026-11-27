// Written with the help of Claude
import { z } from 'zod';
import { PlaceLookup } from '../../core/listings/adapters/place-lookup.ts';
import type { PlaceDescription, Point } from '../../core/listings/types/place.ts';
import type { HttpClient } from '../providers/http-client.ts';
import { NOMINATIM_BASE_URL } from './nominatim-geocoder.ts';

const ReverseResult = z.union([
  z.object({ error: z.string() }),
  z.object({
    name: z.string().nullish(),
    address: z.record(z.string(), z.string()).default({}),
  }),
]);

/**
 * OpenStreetMap's Nominatim `/reverse` behind the PlaceLookup port, with the import geocoder's base URL and
 * User-Agent. Its usage policy allows at most one request per second: the client queues requests one per interval.
 * The data is © OpenStreetMap contributors, under the ODbL.
 */
export class NominatimPlaceLookup extends PlaceLookup {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string = NOMINATIM_BASE_URL,
  ) {
    super();
  }

  async describe({ lat, lng }: Point): Promise<PlaceDescription | undefined> {
    const url = new URL('/reverse', this.baseUrl);
    // Zoom 18: a building or a place in it, not the street or the district.
    url.search = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      zoom: '18',
      addressdetails: '1',
    }).toString();
    const response = await this.http.get(url.href, { 'accept-language': 'uk' });
    if (response.status !== 200) {
      throw new Error(`Nominatim answered ${response.status}`);
    }
    const result = ReverseResult.parse(JSON.parse(response.text));
    return 'error' in result ? undefined : describePlace(result.name ?? '', result.address);
  }
}

/** The place's own name, else the street and the house; the address is the street, the house and the district. */
export function describePlace(name: string, address: Record<string, string>): PlaceDescription | undefined {
  const street = address.road ?? address.pedestrian ?? address.square ?? address.footway;
  const streetAndHouse = [street, address.house_number].filter(Boolean).join(', ');
  const district = address.city_district ?? address.borough ?? address.suburb;
  const title = name.trim() || streetAndHouse;
  if (!title) {
    return undefined;
  }
  return { name: title, address: [streetAndHouse, district].filter(Boolean).join(', ') };
}
