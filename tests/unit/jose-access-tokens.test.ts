// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { SignJWT } from 'jose';
import type { AccountCaller, GuestCaller } from '../../dist/core/identity/types/caller.js';
import { JoseAccessTokens } from '../../dist/infra/auth/jose-access-tokens.js';
import type { SigningKey } from '../../dist/infra/auth/key-files.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';
import { useFixedClock } from './fixtures/clock.ts';

const LIFETIME_SECONDS = 60 * 60; // SEC-005
const KEY: SigningKey = { kid: 'key-1', secret: Buffer.alloc(32, 7) };
const NEW_KEY: SigningKey = { kid: 'key-2', secret: Buffer.alloc(32, 9) };

function anAccountCaller(overrides: Partial<AccountCaller> = {}): AccountCaller {
  return {
    kind: 'account',
    accountId: ACCOUNT_ID,
    role: 'user',
    sessionId: 'f0000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

function aGuestCaller(): GuestCaller {
  return { kind: 'guest', guestId: 'f0000000-0000-4000-8000-000000000002' };
}

/** A token with the claims the API issues, built by hand so a test can change one part of it. */
function aToken({
  key = KEY,
  typ = 'at+jwt',
  issuer = 'nearby-api',
  audience = 'nearby-api',
  claims = { role: 'user', sid: anAccountCaller().sessionId } as Record<string, unknown>,
} = {}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', kid: key.kid, typ })
    .setSubject(ACCOUNT_ID)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${LIFETIME_SECONDS}s`)
    .sign(key.secret);
}

describe('JoseAccessTokens', () => {
  useFixedClock();

  test('verifies the account it issued a token for', async () => {
    const tokens = new JoseAccessTokens([KEY]);
    const caller = anAccountCaller({ role: 'admin' });

    assert.deepEqual(await tokens.verify(await tokens.issue(caller, LIFETIME_SECONDS)), caller);
  });

  test('verifies the guest it issued a token for', async () => {
    const tokens = new JoseAccessTokens([KEY]);
    const caller = aGuestCaller();

    assert.deepEqual(await tokens.verify(await tokens.issue(caller, LIFETIME_SECONDS)), caller);
  });

  test('accepts a token a second before it expires', async () => {
    const tokens = new JoseAccessTokens([KEY]);
    const token = await tokens.issue(anAccountCaller(), LIFETIME_SECONDS);

    mock.timers.tick((LIFETIME_SECONDS - 1) * 1000);

    assert.deepEqual(await tokens.verify(token), anAccountCaller());
  });

  test('refuses a token at the second it expires', async () => {
    const tokens = new JoseAccessTokens([KEY]);
    const token = await tokens.issue(anAccountCaller(), LIFETIME_SECONDS);

    mock.timers.tick(LIFETIME_SECONDS * 1000);

    assert.equal(await tokens.verify(token), undefined);
  });

  test('still verifies tokens of the old key after a new key is put first, and signs with the new one', async () => {
    const oldToken = await new JoseAccessTokens([KEY]).issue(anAccountCaller(), LIFETIME_SECONDS);
    const rotated = new JoseAccessTokens([NEW_KEY, KEY]);

    const newToken = await rotated.issue(anAccountCaller(), LIFETIME_SECONDS);

    assert.deepEqual(await rotated.verify(oldToken), anAccountCaller());
    assert.equal(await new JoseAccessTokens([KEY]).verify(newToken), undefined);
  });

  const forgedTokens = [
    { title: 'refuses a token signed with a key it does not know', token: () => aToken({ key: NEW_KEY }) },
    {
      title: 'refuses a token signed with another secret under a known kid',
      token: () => aToken({ key: { kid: KEY.kid, secret: Buffer.alloc(32, 1) } }),
    },
    { title: 'refuses another kind of JWT signed with the same key', token: () => aToken({ typ: 'JWT' }) },
    { title: 'refuses a token from another issuer', token: () => aToken({ issuer: 'someone-else' }) },
    { title: 'refuses a token for another audience', token: () => aToken({ audience: 'someone-else' }) },
    { title: 'refuses a user token without a session', token: () => aToken({ claims: { role: 'user' } }) },
    {
      title: 'refuses an unknown role',
      token: () => aToken({ claims: { role: 'owner', sid: anAccountCaller().sessionId } }),
    },
  ];

  for (const { title, token } of forgedTokens) {
    test(title, async () => {
      const tokens = new JoseAccessTokens([KEY]);

      assert.equal(await tokens.verify(await token()), undefined);
    });
  }

  test('needs at least one key', () => {
    assert.throws(() => new JoseAccessTokens([]), /At least one signing key is required/);
  });
});
