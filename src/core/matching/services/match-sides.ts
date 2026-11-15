// Written with the help of Claude
import type { Application } from '../types/application.ts';
import { type MatchRecord, type MatchStatus, type MatchViewStatus, PENDING_STATUSES } from '../types/match.ts';

/** The caller's application and the other's; undefined when the caller takes no part in the match. */
export function sidesOf(
  match: MatchRecord,
  userId: string,
): { side: 'a' | 'b'; own: Application; other: Application } | undefined {
  if (match.applicationA.userId === userId) {
    return { side: 'a', own: match.applicationA, other: match.applicationB };
  }
  if (match.applicationB.userId === userId) {
    return { side: 'b', own: match.applicationB, other: match.applicationA };
  }
  return undefined;
}

/** The status as the participant on `side` sees it at `now`; the other's acceptance stays hidden until mutual. */
export function viewStatus(status: MatchStatus, validUntil: string, side: 'a' | 'b', now: Date): MatchViewStatus {
  if (PENDING_STATUSES.includes(status) && new Date(validUntil) <= now) {
    return 'expired';
  }
  if (status === 'accepted_a' || status === 'accepted_b') {
    return status === `accepted_${side}` ? 'accepted' : 'proposed';
  }
  return status;
}

/** The status once the participant on `side` accepts a pending proposal. */
export function acceptedStatus(status: MatchStatus, side: 'a' | 'b'): MatchStatus {
  return status === 'proposed' ? `accepted_${side}` : 'mutual';
}
