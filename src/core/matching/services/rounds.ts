// Written with the help of Claude
import { DAY_MS, HOUR_MS } from '../../common/durations.ts';

/** How long before a session starts each round pairs its pool (matching.md, policy). */
const ROUND_OFFSETS_MS = [7 * DAY_MS, 3 * DAY_MS, DAY_MS, 6 * HOUR_MS];

/** The first round after `now`; undefined once the last round has run. */
export function nextRoundAt(sessionStartsAt: Date | string, now: Date = new Date()): Date | undefined {
  const start = new Date(sessionStartsAt).getTime();
  return ROUND_OFFSETS_MS.map((offset) => new Date(start - offset)).find((round) => round > now);
}
