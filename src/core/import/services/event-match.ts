// Written with the help of Claude
import { containsRun, simplified } from './venue-match.ts';

/** The words of an event title, compared as venue names are: lower case, no quotes, brackets or punctuation. */
export function titleWords(title: string): string[] {
  return simplified(title).split(' ').filter(Boolean);
}

/**
 * Whether two providers' titles may name one event (ADR-006, decision 8): the same words, or the words of one run on
 * in the other ("Антитіла" and "Антитіла. Великий концерт"). Only asked about events at one venue at one start time.
 */
export function similarTitles(a: string, b: string): boolean {
  const [first, second] = [titleWords(a), titleWords(b)];
  if (first.length === 0 || second.length === 0) {
    return false;
  }
  const [shorter, longer] = first.length <= second.length ? [first, second] : [second, first];
  return containsRun(longer, shorter);
}
