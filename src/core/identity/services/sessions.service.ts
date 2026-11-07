// Written with the help of Claude
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { DAY_MS, HOUR_SECONDS } from '../../common/durations.ts';
import { AccessTokens } from '../adapters/access-tokens.ts';
import { AccountsRepository } from '../repositories/accounts.repository.ts';
import { SessionsRepository } from '../repositories/sessions.repository.ts';
import type { SessionTokens } from '../types/auth.ts';
import type { Session } from '../types/session.ts';
import type { AccountRole } from '../types/caller.ts';

// SEC-005
export const ACCESS_TOKEN_SECONDS = HOUR_SECONDS;
const REFRESH_TOKEN_MS = 30 * DAY_MS;
// A refresh whose answer was lost comes back with the token it replaced; accepted this long after the rotation
// (REL-08). Okta allows at most 60 s, as does the OAuth working group's proposal for grace periods.
export const REFRESH_REUSE_MS = 60 * 1000;
const SECRET_BYTES = 32;

/** `<session id>.<secret>`: the id finds the row, the secret proves the token. */
const REFRESH_TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly accessTokens: AccessTokens,
  ) {}

  async start(accountId: string, role: AccountRole): Promise<SessionTokens> {
    const secret = newSecret();
    const session = await this.sessionsRepository.create({
      accountId,
      tokenHash: hashSecret(secret),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
    });
    return this.tokens(session.id, accountId, role, secret);
  }

  /**
   * Rotates the refresh token: the old one stops working and the session gets another 30 days. The token the last
   * rotation replaced still works for 60 s, as the retry of an answer that was lost; it rotates again, and the token
   * whose answer was lost stops working. Any other secret means a stolen or replayed token: it ends the session for
   * both holders.
   */
  async refresh(refreshToken: string): Promise<SessionTokens> {
    const [, sessionId, secret] = REFRESH_TOKEN.exec(refreshToken) ?? [];
    if (!sessionId || !secret) {
      throw invalidRefreshToken();
    }
    const now = new Date();
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw invalidRefreshToken();
    }
    const account = await this.accountsRepository.findById(session.accountId);
    const presented = hashSecret(secret);
    const current = sameHash(session.tokenHash, presented);
    const retry = !current && isRetryOfLostAnswer(session, presented, now);
    if ((!current && !retry) || account?.status !== 'active') {
      await this.sessionsRepository.revoke(session.id, now);
      throw invalidRefreshToken();
    }
    const next = newSecret();
    const rotated = await this.sessionsRepository.rotate(session.id, session.tokenHash, {
      tokenHash: hashSecret(next),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_MS),
      // A retry keeps the token it was made with as the previous one, and the 60 s of the first rotation.
      ...(retry
        ? { previousTokenHash: presented, rotatedAt: session.rotatedAt! }
        : { previousTokenHash: session.tokenHash, rotatedAt: now }),
    });
    if (!rotated) {
      await this.sessionsRepository.revoke(session.id, now);
      throw invalidRefreshToken();
    }
    return this.tokens(session.id, account.id, account.role, next);
  }

  async end(sessionId: string): Promise<void> {
    await this.sessionsRepository.revoke(sessionId, new Date());
  }

  /** Ends every session of the account, or every one but `exceptSessionId`. */
  async endAll(accountId: string, exceptSessionId?: string): Promise<void> {
    await this.sessionsRepository.revokeAll(accountId, new Date(), exceptSessionId);
  }

  /** Checked on every request, so a sign-out or ban takes effect before the access token expires (SEC-005). */
  async isActive(sessionId: string, accountId: string): Promise<boolean> {
    const session = await this.sessionsRepository.findById(sessionId);
    return (
      session?.accountId === accountId &&
      session.accountStatus === 'active' &&
      !session.revokedAt &&
      session.expiresAt > new Date()
    );
  }

  private async tokens(
    sessionId: string,
    accountId: string,
    role: AccountRole,
    secret: string,
  ): Promise<SessionTokens> {
    const accessToken = await this.accessTokens.issue(
      { kind: 'account', accountId, role, sessionId },
      ACCESS_TOKEN_SECONDS,
    );
    return { accessToken, expiresIn: ACCESS_TOKEN_SECONDS, refreshToken: `${sessionId}.${secret}` };
  }
}

function newSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

// The secret is random, so a plain hash is enough: there is nothing to guess.
function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('base64url');
}

function sameHash(stored: string, actual: string): boolean {
  const [a, b] = [Buffer.from(stored), Buffer.from(actual)];
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The token the last rotation replaced, within 60 s of it. */
function isRetryOfLostAnswer(session: Session, presented: string, now: Date): boolean {
  return (
    session.previousTokenHash !== null &&
    session.rotatedAt !== null &&
    sameHash(session.previousTokenHash, presented) &&
    now.getTime() - session.rotatedAt.getTime() <= REFRESH_REUSE_MS
  );
}

function invalidRefreshToken(): DomainError {
  return new DomainError('INVALID_REFRESH_TOKEN', 'The session has ended. Sign in again');
}
