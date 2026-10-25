// Written with the help of Claude
import type { AccountStatus } from './account.ts';

/** One signed-in device: a row of refresh_tokens. Access tokens carry its id as `sid` (SEC-005). */
export interface Session {
  id: string;
  accountId: string;
  /** SHA-256 of the secret part of the refresh token. */
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Read with the session, so a ban ends it on the next request. */
  accountStatus: AccountStatus;
}

/** A new row as the repository stores it. */
export type SessionRecord = Pick<Session, 'accountId' | 'tokenHash' | 'expiresAt'>;
