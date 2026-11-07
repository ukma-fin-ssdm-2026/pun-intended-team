// Written with the help of Claude
import { addDays, kyivDate } from './kyiv-time.ts';

/** How far ahead the catalog shows events, in days after today (Kyiv). */
export const CATALOG_WINDOW_DAYS = 28;

/** The Kyiv dates the catalog shows on the day of `now`, both included, as YYYY-MM-DD. */
export function catalogWindow(now: Date = new Date()): { from: string; to: string } {
  const from = kyivDate(now);
  return { from, to: addDays(from, CATALOG_WINDOW_DAYS) };
}
