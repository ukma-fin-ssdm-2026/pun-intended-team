// Written with the help of Claude
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { GoogleIdTokens } from '../../core/identity/adapters/google-id-tokens.ts';

// Google signs ID tokens with RS256 and uses either form of its issuer.
const ALGORITHM = 'RS256';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
// Google's keys could not be fetched: not a bad token, so they surface as a server error.
const KEY_FETCH_ERRORS = new Set(['ERR_JOSE_GENERIC', 'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID']);

/** Whether an error means Google's keys could not be fetched, rather than that the token is bad (REL-09). */
export function isGoogleKeyFetchFailure(error: unknown): boolean {
  return error instanceof errors.JOSEError && KEY_FETCH_ERRORS.has(error.code);
}

/** Verifies Google ID tokens locally against Google's published keys. */
export class JoseGoogleIdTokens implements GoogleIdTokens {
  constructor(
    private readonly clientIds: string[],
    private readonly keys: JWTVerifyGetKey,
  ) {}

  async verify(idToken: string): Promise<string | undefined> {
    if (this.clientIds.length === 0) {
      return undefined;
    }
    try {
      const { payload } = await jwtVerify(idToken, (header, token) => this.key(header, token), {
        algorithms: [ALGORITHM],
        issuer: ISSUERS,
        audience: this.clientIds,
        requiredClaims: ['sub', 'iat', 'exp'],
      });
      return payload.sub;
    } catch (error) {
      if (error instanceof errors.JOSEError && !isGoogleKeyFetchFailure(error)) {
        return undefined;
      }
      throw error;
    }
  }

  // jose passes on fetch's own error when Google cannot be reached at all (refused, DNS): a key fetch failure too.
  private async key(...args: Parameters<JWTVerifyGetKey>): Promise<Awaited<ReturnType<JWTVerifyGetKey>>> {
    try {
      return await this.keys(...args);
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        throw error;
      }
      throw new errors.JOSEError("Google's keys could not be fetched", { cause: error });
    }
  }
}
