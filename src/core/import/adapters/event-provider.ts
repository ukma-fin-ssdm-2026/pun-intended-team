// Written with the help of Claude
import type { NormalizeResult } from '../types/import.ts';

/**
 * One external listing service (HLD I5, FLEX-003). Everything specific to a provider lives in its
 * implementation: how records are fetched and how they map to our event model.
 */
export abstract class EventProvider {
  /** Stable id stored with every imported event, e.g. `concert_ua`. */
  abstract readonly id: string;

  /** The provider's raw records, as received. */
  abstract fetch(since?: Date): Promise<unknown[]>;

  /** One raw record in our shape, or the reason it cannot be used. Never throws. */
  abstract normalize(raw: unknown): NormalizeResult;
}
