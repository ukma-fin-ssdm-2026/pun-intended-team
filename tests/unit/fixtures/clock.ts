// Written with the help of Claude
import { afterEach, beforeEach, mock } from 'node:test';

/** 12:00 in Kyiv. */
export const NOW = new Date('2026-10-15T09:00:00Z');
/** The Kyiv date of NOW. */
export const TODAY = '2026-10-15';

/** Freezes Date at `now` for every test in the enclosing describe. */
export function useFixedClock(now: Date = NOW): void {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now }));
  afterEach(() => mock.timers.reset());
}
