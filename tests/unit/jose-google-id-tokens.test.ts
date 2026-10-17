// Written with the help of Claude
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey, SignJWT } from 'jose';
import { JoseGoogleIdTokens } from '../../dist/infra/auth/jose-google-id-tokens.js';
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

  test('rejects every token when no client id is configured', async () => {
    const idTokens = new JoseGoogleIdTokens([], googleKeys);

    assert.equal(await idTokens.verify(await anIdToken()), undefined);
  });
});
