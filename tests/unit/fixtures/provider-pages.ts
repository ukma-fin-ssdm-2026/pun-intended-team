// Written with the help of Claude
import { readFileSync } from 'node:fs';
import type { HttpClient, HttpResponse } from '../../../dist/infra/providers/http-client.js';

/** A page saved in `fixtures/providers/`, as received. */
export function savedPage(file: string): string {
  return readFileSync(new URL(`providers/${file}`, import.meta.url), 'utf8');
}

/** Today in Kyiv for the saved pages, which were saved on this day. */
export const PAGES_SAVED_AT = new Date('2026-11-03T10:00:00Z');

type Route = string | { status: number; text?: string } | Error;

/**
 * An HttpClient that answers from the saved pages: `routes` maps a path to a fixture file, a status, or an error
 * to throw. Any other path answers 404. Every requested URL is recorded.
 */
export function savedPagesClient(routes: Record<string, Route>): HttpClient & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    get(url: string): Promise<HttpResponse> {
      requested.push(url);
      const route = routes[new URL(url).pathname];
      if (route instanceof Error) {
        return Promise.reject(route);
      }
      if (route === undefined) {
        return Promise.resolve({ status: 404, url, text: '' });
      }
      return Promise.resolve(
        typeof route === 'string'
          ? { status: 200, url, text: savedPage(route) }
          : { status: route.status, url, text: route.text ?? '' },
      );
    },
  };
}
