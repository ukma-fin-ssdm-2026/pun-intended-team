// Written with the help of Claude
// REL-09 fault injection: the built API (dist/) with GOOGLE_JWKS_URL pointing at a fake key server that never
// answers, answers 500, or is not there at all. A Google sign-in must then answer 503 SERVICE_UNAVAILABLE, the same
// as a database timeout, while a bad token keeps its own error. Needs no database and never calls Google.
// Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';
import { type ApiProcess, apiEnvironment, freePort, startApi, stopApi } from './api-process.ts';

const CLIENT_ID = 'reliability-test.apps.googleusercontent.com';
// jose gives up on a key set request after 5 s by default.
const JWKS_TIMEOUT_MS = 5_000;
const SLACK_MS = 2_000;

const UNAVAILABLE = {
  error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable. Try again later' },
};

/** `silent` accepts the request and never answers, `error` answers 500. */
type KeyServerMode = 'silent' | 'error';

let api: ApiProcess;
let removeKeys: () => void;
let keyServer: Server;
let mode: KeyServerMode = 'silent';
const sockets = new Set<Socket>();
const waiting = new Set<ServerResponse>();

/** An ID token as Google would issue it to the app; its key does not matter, the key set is never received. */
async function anIdToken(): Promise<string> {
  const { privateKey } = await generateKeyPair('RS256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'google-key-1' })
    .setSubject('109876543210987654321')
    .setIssuer('https://accounts.google.com')
    .setAudience(CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

async function signInWithGoogle(path: string, idToken: string) {
  const started = Date.now();
  const response = await fetch(`${api.url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
    // A guard of its own, so a regression fails the test instead of hanging it.
    signal: AbortSignal.timeout(JWKS_TIMEOUT_MS + 5_000),
  });
  return { status: response.status, body: (await response.json()) as unknown, elapsed: Date.now() - started };
}

before(async () => {
  keyServer = createServer((_request, response) => {
    if (mode === 'error') {
      response.writeHead(500).end();
    } else {
      waiting.add(response);
    }
  });
  keyServer.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  const keyServerPort = await freePort();
  await new Promise<void>((resolve) => keyServer.listen(keyServerPort, resolve));
  // Nothing listens on a port freePort has just given back.
  const { env, cleanup } = apiEnvironment(`postgresql://nearby_main:password@127.0.0.1:${await freePort()}/nearby`);
  removeKeys = cleanup;
  api = await startApi({
    ...env,
    GOOGLE_CLIENT_IDS: CLIENT_ID,
    GOOGLE_JWKS_URL: `http://127.0.0.1:${keyServerPort}/certs`,
    ALLOW_TEST_ADAPTERS: 'true',
  });
});

after(async () => {
  await stopApi(api.child);
  for (const socket of sockets) {
    socket.destroy();
  }
  await new Promise((resolve) => keyServer.close(resolve));
  removeKeys();
});

// REL-09
describe("a Google sign-in while Google's keys cannot be fetched", () => {
  test('answers 503 after the key set request times out, and logs the cause', async () => {
    mode = 'silent';

    const { status, body, elapsed } = await signInWithGoogle('/api/v1/auth/google', await anIdToken());

    assert.equal(status, 503);
    assert.deepEqual(body, UNAVAILABLE);
    // Within jose's limit, not after the 10 s guard: the request ended on the timeout, not on the test.
    assert.ok(elapsed < JWKS_TIMEOUT_MS + SLACK_MS, `${elapsed} ms`);
    assert.match(api.output(), /A dependency is unavailable: request timed out/);
    assert.ok(waiting.size > 0, 'the API asked the fake key server, not Google');
  });

  test('answers 503 when the key server answers 500', async () => {
    mode = 'error';

    const { status, body } = await signInWithGoogle('/api/v1/auth/google/register', await anIdToken());

    assert.equal(status, 503);
    assert.deepEqual(body, UNAVAILABLE);
    assert.match(api.output(), /A dependency is unavailable: Expected 200 OK/);
  });

  test('answers 503 when the key server cannot be reached', async () => {
    for (const response of waiting) {
      response.destroy();
    }
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => keyServer.close(resolve));

    const { status, body } = await signInWithGoogle('/api/v1/auth/google', await anIdToken());

    assert.equal(status, 503);
    assert.deepEqual(body, UNAVAILABLE);
    assert.match(api.output(), /A dependency is unavailable: Google's keys could not be fetched/);
  });

  test('keeps the errors of a token that is not a JWT, which needs no key', async () => {
    assert.deepEqual(
      await signInWithGoogle('/api/v1/auth/google/register', 'not-a-token').then(({ status, body }) => ({
        status,
        body,
      })),
      {
        status: 422,
        body: { error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Google sign-in did not go through. Try again' } },
      },
    );
    const signIn = await signInWithGoogle('/api/v1/auth/google', 'not-a-token');
    assert.equal(signIn.status, 401);
    assert.equal((signIn.body as { error: { code: string } }).error.code, 'INVALID_CREDENTIALS');
  });
});
