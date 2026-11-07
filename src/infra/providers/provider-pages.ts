// Written with the help of Claude
// Shared by the scraping adapters: reading schema.org JSON-LD out of a page and fitting text to our event schema.
import { load } from 'cheerio';
import { kyivDate } from '../../core/common/kyiv-time.ts';

/** Limits of our API's event schema: the catalog answers 500 for an event outside them. */
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;

/** Every object in the page's `<script type="application/ld+json">` blocks; a block that is not JSON is ignored. */
export function jsonLdObjects(html: string): Record<string, unknown>[] {
  const $ = load(html);
  return $('script[type="application/ld+json"]')
    .toArray()
    .flatMap((script) => {
      try {
        const parsed: unknown = JSON.parse($(script).text());
        return Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
      } catch {
        return [];
      }
    })
    .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null);
}

/** The last non-empty path segment of a URL, e.g. `lama-15` for `https://kyiv.karabas.com/lama-15/`. */
export function slugOf(url: string): string {
  return new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
}

/** Whether an instant falls on a Kyiv date of the catalog window. */
export function inWindow(instant: Date, window: { from: string; to: string }): boolean {
  const date = kyivDate(instant);
  return date >= window.from && date <= window.to;
}

export function fitTitle(text: string): string {
  return truncate(text.trim(), TITLE_MAX);
}

export function fitDescription(text: string): string {
  return truncate(text.trim(), DESCRIPTION_MAX);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
