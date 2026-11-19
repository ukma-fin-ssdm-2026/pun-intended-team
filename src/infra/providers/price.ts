// Written with the help of Claude
// Shared by the providers' adapters: a provider's ticket prices as the event's price (ADR-006, decision 12).
import type { ImportedEvent } from '../../core/import/types/import.ts';

export type EventPrice = Pick<ImportedEvent, 'priceMin' | 'priceMax'>;

/** No price from the provider: the app shows none. */
export const UNKNOWN_PRICE: EventPrice = { priceMin: null, priceMax: null };

/**
 * One price in whole hryvnias, rounded half up with `Math.round` (449.5 is 450): a non-negative number, or a string
 * of one such as schema.org allows ("450", "449.50", "449,50"). Undefined for anything else.
 */
export function wholeHryvnias(value: unknown): number | undefined {
  const text = typeof value === 'string' ? value.trim().replace(',', '.') : '';
  // Number() turns "1.2.3" into NaN, so digits and dots are enough to check.
  const amount = typeof value === 'number' ? value : /^[\d.]+$/.test(text) ? Number(text) : Number.NaN;
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : undefined;
}

/**
 * The event's price from every price the provider gives: the lowest, and the highest only when it is above it. A
 * value that is not a price is left out; without any price, the price is unknown.
 */
export function priceOf(values: unknown[]): EventPrice {
  const prices = values.map(wholeHryvnias).filter((price) => price !== undefined);
  if (prices.length === 0) {
    return UNKNOWN_PRICE;
  }
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  return { priceMin, priceMax: priceMax > priceMin ? priceMax : null };
}
