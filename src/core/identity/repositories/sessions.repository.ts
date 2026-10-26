// Written with the help of Claude
import type { Session, SessionRecord } from '../types/session.ts';

export abstract class SessionsRepository {
  abstract create(session: SessionRecord): Promise<Session>;

  abstract findById(id: string): Promise<Session | undefined>;

  /**
   * Replaces the token hash and expiry if the session still has `currentHash` and is not revoked; false otherwise,
   * so concurrent refreshes cannot both rotate the same token.
   */
  abstract rotate(id: string, currentHash: string, next: Pick<Session, 'tokenHash' | 'expiresAt'>): Promise<boolean>;

  abstract revoke(id: string, revokedAt: Date): Promise<void>;

  /** Revokes every session of the account but `exceptId`. */
  abstract revokeAll(accountId: string, revokedAt: Date, exceptId?: string): Promise<void>;
}
