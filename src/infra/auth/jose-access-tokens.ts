// Written with the help of Claude
import { errors, jwtVerify, type JWTHeaderParameters, SignJWT } from 'jose';
import { z } from 'zod';
import { AccessTokens } from '../../core/identity/adapters/access-tokens.ts';
import type { Caller } from '../../core/identity/types/caller.ts';
import type { SigningKey } from './key-files.ts';

const ALGORITHM = 'HS256';
const ISSUER = 'nearby-api';
const AUDIENCE = 'nearby-api';
// RFC 9068: marks the JWT as an access token, so another kind of JWT signed with the same key is refused.
const TYPE = 'at+jwt';

const Claims = z.union([
  z.object({ role: z.literal('guest'), sub: z.uuid() }),
  z.object({ role: z.literal('registrant'), sub: z.uuid() }),
  z.object({ role: z.enum(['user', 'admin']), sub: z.uuid(), sid: z.uuid() }),
]);

/** HS256 JWTs: `sub` is the account or guest id, `role` the caller's role, `sid` the session of an account. */
export class JoseAccessTokens implements AccessTokens {
  private readonly signingKey: SigningKey;
  private readonly secrets: Map<string, Uint8Array>;

  constructor(keys: SigningKey[]) {
    const [signingKey] = keys;
    if (!signingKey) {
      throw new Error('At least one signing key is required');
    }
    this.signingKey = signingKey;
    this.secrets = new Map(keys.map(({ kid, secret }) => [kid, secret]));
  }

  issue(caller: Caller, lifetimeSeconds: number): Promise<string> {
    const [subject, claims] =
      caller.kind === 'guest'
        ? [caller.guestId, { role: 'guest' }]
        : caller.kind === 'registrant'
          ? [caller.accountId, { role: 'registrant' }]
          : [caller.accountId, { role: caller.role, sid: caller.sessionId }];
    return new SignJWT(claims)
      .setProtectedHeader({ alg: ALGORITHM, kid: this.signingKey.kid, typ: TYPE })
      .setSubject(subject)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${lifetimeSeconds}s`)
      .sign(this.signingKey.secret);
  }

  async verify(token: string): Promise<Caller | undefined> {
    let payload: unknown;
    try {
      ({ payload } = await jwtVerify(token, (header) => this.secretFor(header), {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
        typ: TYPE,
        requiredClaims: ['sub', 'iat', 'exp'],
      }));
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        return undefined;
      }
      throw error;
    }
    const claims = Claims.safeParse(payload);
    if (!claims.success) {
      return undefined;
    }
    const { data } = claims;
    switch (data.role) {
      case 'guest':
        return { kind: 'guest', guestId: data.sub };
      case 'registrant':
        return { kind: 'registrant', accountId: data.sub };
      default:
        return { kind: 'account', accountId: data.sub, role: data.role, sessionId: data.sid };
    }
  }

  private secretFor({ kid }: JWTHeaderParameters): Uint8Array {
    const secret = kid === undefined ? undefined : this.secrets.get(kid);
    if (!secret) {
      throw new errors.JWKSNoMatchingKey();
    }
    return secret;
  }
}
