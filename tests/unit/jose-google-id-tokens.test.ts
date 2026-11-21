// Written with the help of Claude
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { createLocalJWKSet, errors, exportJWK, generateKeyPair, type JWTVerifyGetKey, SignJWT } from 'jose';
import { isGoogleKeyFetchFailure, JoseGoogleIdTokens } from '../../dist/infra/auth/jose-google-id-tokens.js';
import { useFixedClock } from './fixtures/clock.ts';

const CLIENT_ID = 'nearby-ios.apps.googleusercontent.com';
const SUBJECT = '109876543210987654321';
const KID = 'google-key-1';

let googleKey: CryptoKey;
let otherKey: CryptoKey;
let googleKeys: JWTVerifyGetKey;

before(async () => {
  const google = await generateKeyPair('RS256', { extractable: true });
  googleKey = google.privateKey;
  otherKey = (await generateKeyPair('RS256')).privateKey;
  googleKeys = createLocalJWKSet({ keys: [{ ...(await exportJWK(google.publicKey)), kid: KID, alg: 'RS256' }] });
});

/** An ID token as Google issues it, built so a test can change one part of it. */
function anIdToken({
  key = googleKey,
  issuer = 'https://accounts.google.com',
  audience = CLIENT_ID,
  expiresIn = '1h',
} = {}): Promise<string> {
  return new SignJWT({ email: 'olena@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(SUBJECT)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

describe('JoseGoogleIdTokens', () => {
  useFixedClock();

  test('returns the subject of a token Google issued to one of the client ids', async () => {
    const idTokens = new JoseGoogleIdTokens(['nearby-android', CLIENT_ID], googleKeys);

    assert.equal(await idTokens.verify(await anIdToken()), SUBJECT);
  });

  test('accepts the issuer without the scheme, which Google also uses', async () => {
    const idTokens = new JoseGoogleIdTokens([CLIENT_ID], googleKeys);

    assert.equal(await idTokens.verify(await anIdToken({ issuer: 'accounts.google.com' })), SUBJECT);
  });

  const rejected: Record<string, () => Promise<string>> = {
    'issued to another app': () => anIdToken({ audience: 'another-app' }),
    'from another issuer': () => anIdToken({ issuer: 'https://evil.example.com' }),
    'signed with a key Google did not publish': () => anIdToken({ key: otherKey }),
    expired: () => anIdToken({ expiresIn: '-1s' }),
    'that is not a JWT': async () => 'not-a-token',
  };

  for (const [name, make] of Object.entries(rejected)) {
    test(`rejects a token ${name}`, async () => {
      const idTokens = new JoseGoogleIdTokens([CLIENT_ID], googleKeys);

      assert.equal(await idTokens.verify(await make()), undefined);
    });
  }

  const keyFetchFailures: Record<string, Error> = {
    'Google answers with an error': new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
    'Google does not answer in time': new errors.JWKSTimeout(),
    'Google sends a broken key set': new errors.JWKSInvalid(),
  };

  for (const [name, failure] of Object.entries(keyFetchFailures)) {
    test(`fails instead of rejecting the token when ${name}`, async () => {
      const idTokens = new JoseGoogleIdTokens([CLIENT_ID], () => Promise.reject(failure));

      await assert.rejects(idTokens.verify(await anIdToken()), failure);
    });
  }

  // jose rethrows fetch's own error when the host cannot be reached at all.
  test('fails with a key fetch error when Google cannot be reached', async () => {
    const unreachable = new TypeError('fetch failed');
    const idTokens = new JoseGoogleIdTokens([CLIENT_ID], () => Promise.reject(unreachable));

    await assert.rejects(idTokens.verify(await anIdToken()), (error: unknown) => {
      assert.ok(isGoogleKeyFetchFailure(error));
      assert.equal((error as Error).cause, unreachable);
      return true;
    });
  });

  test('rejects every token when no client id is configured', async () => {
    const idTokens = new JoseGoogleIdTokens([], googleKeys);

    assert.equal(await idTokens.verify(await anIdToken()), undefined);
  });
});

// REL-09: these errors answer 503, so the app knows it may try again; a bad token stays a rejected sign-in.
describe('isGoogleKeyFetchFailure', () => {
  const fetchFailures: Record<string, Error> = {
    ERR_JOSE_GENERIC: new errors.JOSEError('Expected 200 OK from the JSON Web Key Set HTTP response'),
    ERR_JWKS_TIMEOUT: new errors.JWKSTimeout(),
    ERR_JWKS_INVALID: new errors.JWKSInvalid(),
  };

  for (const [code, error] of Object.entries(fetchFailures)) {
    test(`is true for ${code}`, () => {
      assert.ok(isGoogleKeyFetchFailure(error));
    });
  }

  const otherErrors: Record<string, unknown> = {
    'a bad signature': new errors.JWSSignatureVerificationFailed(),
    'a wrong audience': new errors.JWTClaimValidationFailed('unexpected "aud" claim value', {}, 'aud', 'check_failed'),
    'a key Google did not publish': new errors.JWKSNoMatchingKey(),
    'a plain Error': new Error('ERR_JWKS_TIMEOUT'),
    'an object with the code': { code: 'ERR_JWKS_TIMEOUT' },
  };

  for (const [title, error] of Object.entries(otherErrors)) {
    test(`is false for ${title}`, () => {
      assert.equal(isGoogleKeyFetchFailure(error), false);
    });
  }
});
