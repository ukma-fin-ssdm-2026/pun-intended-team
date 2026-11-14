// Written with the help of Claude
import type { Venue } from '../../catalog/types/venue.ts';
import { inKyiv } from '../../common/kyiv-area.ts';
import type { ImportedVenue } from '../types/import.ts';

/**
 * Words of an address that name the kind of street, the city or an initial, which providers write in different
 * ways or leave out: "вулиця Саксаганського, 6, Київ" and "вул. Саксаганського, 6" are one address.
 */
const ADDRESS_NOISE = new Set([
  'вул',
  'вулиця',
  'ул',
  'улица',
  'просп',
  'проспект',
  'пр-т',
  'бульв',
  'бульвар',
  'б-р',
  'пл',
  'площа',
  'пров',
  'провулок',
  'наб',
  'набережна',
  'буд',
  'м',
  'київ',
  'kyiv',
]);

/** Karabas writes some venue names after this label, e.g. "Місце проведення: МЦКМ". */
const NAME_LABEL = /^місце проведення\s*:\s*/;

/**
 * An address as the import compares it (ADR-006, decision 7): in lower case, without notes in brackets, punctuation,
 * the kind of street, the city (once or twice) and initials. Empty when no word of it has a digit: without a house
 * number the address cannot tell two venues apart.
 */
export function normalizedAddress(address: string): string {
  const words = simplified(address.replace(/\([^)]*\)/g, ' '))
    .split(' ')
    .filter((word) => word && !ADDRESS_NOISE.has(word) && !/^\p{L}$/u.test(word));
  return words.some((word) => /\d/.test(word)) ? words.join(' ') : '';
}

/** The words of a venue name, in lower case, without quotes, brackets, punctuation and the Karabas label. */
export function nameWords(name: string): string[] {
  return simplified(name.toLowerCase().trim().replace(NAME_LABEL, '')).split(' ').filter(Boolean);
}

/**
 * Words that say what kind of place a venue is, or describe it, rather than which one: two names that share only such
 * words ("Будинок Кіно" and "Будинок вчених") are not one venue. Matched as whole words.
 */
const GENERIC_NAME_WORDS = new Set([
  // kinds of place
  'будинок',
  'дім',
  'театр',
  'кінотеатр',
  'клуб',
  'палац',
  'центр',
  'зала',
  'зал',
  'хол',
  'сцена',
  'галерея',
  'музей',
  'студія',
  'простір',
  'бар',
  'паб',
  'кафе',
  'ресторан',
  'арт',
  'pub',
  'club',
  'music',
  'hall',
  'bar',
  'cafe',
  'art',
  'gallery',
  'museum',
  'theatre',
  'theater',
  'cinema',
  'stage',
  'space',
  'studio',
  'house',
  'center',
  'centre',
  // descriptions
  'національний',
  'національна',
  'центральний',
  'центральна',
  'київський',
  'київська',
  'міський',
  'міська',
  'державний',
  'академічний',
  'драматичний',
  'культурний',
  'культури',
  'мистецтв',
  'мистецтва',
  'мала',
  'малий',
  'велика',
  'великий',
  'ім',
  'імені',
  // small words
  'на',
  'в',
  'у',
  'і',
  'й',
  'та',
  'the',
  'of',
  'and',
]);

/**
 * Whether two names may be one venue (ADR-006, decision 7). The same name always is. Otherwise they must share a
 * distinctive word, one that `GENERIC_NAME_WORDS` does not list, and either one contains the other word for word ("Pepper's Club" and
 * `Music Pub "Pepper's Club"`), or they share at least half of the distinctive words of the one with more ("Палац
 * Україна" and "Національний палац мистецтв «Україна»"). Only ever asked about venues at the same address.
 */
export function similarNames(a: string, b: string): boolean {
  const [first, second] = [nameWords(a), nameWords(b)];
  // The same name is one venue, also one made only of generic words, such as "Малий театр".
  if (first.length > 0 && first.join(' ') === second.join(' ')) {
    return true;
  }
  const [few, many] = [distinctive(first), distinctive(second)].sort((x, y) => x.size - y.size) as [
    Set<string>,
    Set<string>,
  ];
  const shared = [...few].filter((word) => many.has(word)).length;
  if (shared === 0) {
    return false;
  }
  const [shorter, longer] = first.length <= second.length ? [first, second] : [second, first];
  return containsRun(longer, shorter) || shared * 2 >= many.size;
}

function distinctive(words: string[]): Set<string> {
  return new Set(words.filter((word) => !GENERIC_NAME_WORDS.has(word)));
}

/**
 * The imported venues saved so far, oldest first, by address as the import compares it. The import asks it for a
 * provider's venue before saving a new one, and tells it about every venue it saves or moves.
 */
export class SavedVenues {
  private readonly byAddress = new Map<string, Venue[]>();

  constructor(venues: Venue[]) {
    for (const venue of venues) {
      this.add(venue);
    }
  }

  /**
   * The oldest saved venue at the same address with a similar name, so duplicates saved before end up as one. A
   * venue a provider placed outside Kyiv is taken only when none in Kyiv fits, and only for a venue that brings its
   * own coordinates: one without them would be shown at the wrong place. An address with no house number is matched
   * as written, and only with the same name.
   */
  find({ name, address, location }: ImportedVenue): Venue | undefined {
    const normalized = normalizedAddress(address);
    const fitting = (this.byAddress.get(keyOf(address)) ?? []).filter((venue) =>
      normalized ? similarNames(venue.name, name) : nameWords(venue.name).join(' ') === nameWords(name).join(' '),
    );
    return fitting.find((venue) => inKyiv(venue.location)) ?? (location ? fitting[0] : undefined);
  }

  add(venue: Venue): void {
    const key = keyOf(venue.address);
    this.byAddress.set(key, [...(this.byAddress.get(key) ?? []), venue]);
  }

  /** Replaces a saved venue whose coordinates changed, in its place in the order. */
  replace(venue: Venue): void {
    const key = keyOf(venue.address);
    this.byAddress.set(
      key,
      (this.byAddress.get(key) ?? []).map((saved) => (saved.id === venue.id ? venue : saved)),
    );
  }
}

function keyOf(address: string): string {
  return normalizedAddress(address) || `as written: ${simplified(address)}`;
}

/** Lower case, one kind of apostrophe, and every other mark but the hyphen in a word as a space. */
export function simplified(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
    .replace(/(^|\s)[-']+|[-']+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsRun(words: string[], run: string[]): boolean {
  return words.some((_, start) => run.every((word, i) => words[start + i] === word));
}
