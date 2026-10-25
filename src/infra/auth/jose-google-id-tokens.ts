// Written with the help of Claude
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { GoogleIdTokens } from '../../core/identity/adapters/google-id-tokens.ts';

// Google signs ID tokens with RS256 and uses either form of its issuer.
const ALGORITHM = 'RS256';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
// Google's keys could not be fetched: not a bad token, so they surface as a server error.
const KEY_FETCH_ERRORS = new Set(['ERR_JOSE_GENERIC', 'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID']);

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
      const { payload } = await jwtVerify(idToken, this.keys, {
        algorithms: [ALGORITHM],
        issuer: ISSUERS,
        audience: this.clientIds,
        requiredClaims: ['sub', 'iat', 'exp'],
      });
      return payload.sub;
    } catch (error) {
      if (error instanceof errors.JOSEError && !KEY_FETCH_ERRORS.has(error.code)) {
        return undefined;
      }
      throw error;
    }
  }
}
