// Written with the help of Claude
import { plural } from '@/plural';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// How long before the session each round runs, as in the API (matching.md, policy).
export const ROUND_OFFSETS_MS = [7 * DAY_MS, 3 * DAY_MS, DAY_MS, 6 * HOUR_MS];

// "3 дні до події", "24 години до події": when a round runs.
export function roundOffsetTitle(offset: number): string {
  if (offset > DAY_MS) {
    const days = offset / DAY_MS;
    return `${days} ${plural(days, ['день', 'дні', 'днів'])} до події`;
  }
  const hours = offset / HOUR_MS;
  return `${hours} ${plural(hours, ['година', 'години', 'годин'])} до події`;
}

// The number of the next round among its day's rounds, from 1, and that day's start; one past the last round when
// none is left.
export function nextRound(
  sessions: { startsAt: string }[],
  nextRoundAt: string | null,
): { number: number; startsAt: string | undefined } {
  if (!nextRoundAt) return { number: ROUND_OFFSETS_MS.length + 1, startsAt: sessions[0]?.startsAt };
  const next = Date.parse(nextRoundAt);
  const day =
    sessions.find(({ startsAt }) => ROUND_OFFSETS_MS.some((offset) => Date.parse(startsAt) - offset === next)) ??
    sessions[0];
  const startsAt = day?.startsAt ?? nextRoundAt;
  return { number: ROUND_OFFSETS_MS.filter((offset) => Date.parse(startsAt) - offset < next).length + 1, startsAt };
}

const pad = (value: number) => String(value).padStart(2, '0');

// Days and hours while a day or more is left, then hours and minutes, then minutes.
export function countdownParts(ms: number): { value: string; unit: string }[] {
  const left = Math.max(0, ms);
  if (left >= DAY_MS) {
    const days = Math.floor(left / DAY_MS);
    return [
      { value: String(days), unit: plural(days, ['день', 'дні', 'днів']) },
      { value: String(Math.floor((left % DAY_MS) / HOUR_MS)), unit: 'год' },
    ];
  }
  const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS);
  if (left < HOUR_MS) return [{ value: String(Math.max(1, minutes)), unit: 'хв' }];
  return [
    { value: String(Math.floor(left / HOUR_MS)), unit: 'год' },
    { value: pad(minutes), unit: 'хв' },
  ];
}

// "5 днів 2 год", "15 год 42 хв", "7 хв".
export function formatSpan(ms: number): string {
  const left = Math.max(0, ms);
  if (left >= DAY_MS) {
    const days = Math.floor(left / DAY_MS);
    const hours = Math.floor((left % DAY_MS) / HOUR_MS);
    return `${days} ${plural(days, ['день', 'дні', 'днів'])}${hours ? ` ${hours} год` : ''}`;
  }
  const hours = Math.floor(left / HOUR_MS);
  const minutes = Math.floor((left % HOUR_MS) / MINUTE_MS);
  if (hours) return `${hours} год${minutes ? ` ${minutes} хв` : ''}`;
  return `${Math.max(1, minutes)} хв`;
}

// The rounds of a day held after the user applied; the earlier ones went without them.
export function roundsSinceApplying(startsAt: string, createdAt: string): number[] {
  return ROUND_OFFSETS_MS.filter((offset) => Date.parse(startsAt) - offset >= Date.parse(createdAt));
}
