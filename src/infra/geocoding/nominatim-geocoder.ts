// Written with the help of Claude
import { z } from 'zod';
import type { Venue } from '../../core/catalog/types/venue.ts';
import { KYIV_AREA } from '../../core/common/kyiv-area.ts';
import { Geocoder } from '../../core/import/adapters/geocoder.ts';
import type { HttpClient } from '../providers/http-client.ts';

export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

/** Kyiv's bounding box (west, north, east, south): a result outside it is not our venue. */
const KYIV_VIEWBOX = [KYIV_AREA.west, KYIV_AREA.north, KYIV_AREA.east, KYIV_AREA.south].join(',');

const SearchResults = z.array(z.object({ lat: z.coerce.number(), lon: z.coerce.number() }));

/**
 * OpenStreetMap's Nominatim behind the Geocoder port. Its usage policy allows at most one request per second with
 * a User-Agent naming the application; the data is © OpenStreetMap contributors, under the ODbL.
 */
export class NominatimGeocoder extends Geocoder {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string = NOMINATIM_BASE_URL,
  ) {
    super();
  }

  async locate({ name, address }: Pick<Venue, 'name' | 'address'>): Promise<Venue['location'] | undefined> {
    // The address as given, then without the notes Karabas addresses carry, then the venue's name.
    for (const query of new Set([address, searchableAddress(address), `${name}, Київ`])) {
      const location = await this.search(query);
      if (location) {
        return location;
      }
    }
    return undefined;
  }

  private async search(query: string): Promise<Venue['location'] | undefined> {
    const url = new URL('/search', this.baseUrl);
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'ua',
      viewbox: KYIV_VIEWBOX,
      bounded: '1',
    }).toString();
    const response = await this.http.get(url.href, { 'accept-language': 'uk' });
    if (response.status !== 200) {
      throw new Error(`Nominatim answered ${response.status}`);
    }
    const [first] = SearchResults.parse(JSON.parse(response.text));
    return first && { lat: first.lat, lng: first.lon };
  }
}

/** Notes in an address that Nominatim cannot match: door codes, floors, entrances, metro stations. */
const ADDRESS_NOTE = /код|поверх|під['’]?їзд|вхід|ст\.\s*м\.|метро/i;

/**
 * The address without its notes, with "пр." spelled out and Kyiv named once at the end, e.g.
 * "Верхній Вал 48/28, код від домофона 2, 2 поверх" → "Верхній Вал 48/28, Київ" and
 * "пр.Академіка Глушкова, 1 ВДНГ" → "проспект Академіка Глушкова, 1, Київ".
 */
export function searchableAddress(address: string): string {
  const parts = withoutParentheses(address)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !ADDRESS_NOTE.test(part) && part.replace(/^м\.\s*/i, '').toLowerCase() !== 'київ')
    .map((part) => houseNumberOnly(part.replace(/^пр(-т|\.)\s*/i, 'проспект ')));
  return [...parts, 'Київ'].join(', ');
}

/** The text without each "(" up to the next ")"; an unclosed "(" and the text after it stay. */
function withoutParentheses(text: string): string {
  let result = '';
  let from = 0;
  for (let open = text.indexOf('('); open !== -1; open = text.indexOf('(', from)) {
    const close = text.indexOf(')', open);
    if (close === -1) {
      break;
    }
    result += text.slice(from, open);
    from = close + 1;
  }
  return result + text.slice(from);
}

/** "1 ВДНГ", a house number with a landmark after it, as "1"; any other part as it is. */
function houseNumberOnly(part: string): string {
  const [first = '', next = ''] = part.split(/\s+/);
  return /^\d/.test(first) && /^\p{L}/u.test(next) ? first : part;
}
