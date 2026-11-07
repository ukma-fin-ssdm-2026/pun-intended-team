// Written with the help of Claude
import type { FetchResult, NormalizeResult } from '../types/import.ts';

/**
 * One external listing service (HLD I5, FLEX-003). Everything specific to a provider lives in its
 * implementation: how records are fetched and how they map to our event model.
 */
export abstract class EventProvider {
  /** Stable id stored with every imported event, e.g. `karabas`. */
  abstract readonly id: string;

  /**
   * The provider's raw records, as received, and whether they are its full list for the window. A page that cannot
   * be fetched is logged and left out, and the list is then not complete; the call fails only when nothing can be
   * fetched at all. `since` is the start of the last successful run, if any.
   */
  abstract fetch(since?: Date): Promise<FetchResult>;

  /** One raw record in our shape, or the reason it cannot be used. Never throws. */
  abstract normalize(raw: unknown): NormalizeResult;
}

/** Injection token for every provider the import runs, in order. An array has no class to serve as the token. */
export const EVENT_PROVIDERS = Symbol('EVENT_PROVIDERS');
