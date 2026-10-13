// Written with the help of Claude
// End-to-end tests added by the team: start the built API (dist/) and call it over HTTP.
// The setup is copied from api.e2e.test.ts. Run with `npm run test:e2e`, which builds first.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

// Category seeded by the seed_categories migration; the event and accounts are from src/infra/stubs/data.ts.
const exhibitions = '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02';
const cancelledFilmEvent = 'b8e5f1c3-2d4a-4c6b-9f0e-1a3d5c7b9e2f';
const seededPassword = 'nearby-dev-password';
const phones = { user: '+380501110001', otherUser: '+380501110002' };

// A week from today in Kyiv, so the listing never falls in the past.
const nextWeek = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(
  Date.now() + 7 * 24 * 3600 * 1000,
);

const newListing = {
  categoryId: exhibitions,
  title: 'Looking for company for an exhibition',
  description: 'Evening, coffee after.',
  date: nextWeek,
};

let server: ChildProcess;
let baseUrl: string;
let keysDir: string;
const tokens = { user: '' };

interface Response {
  status: number;
  headers: Headers;
  // Parsed JSON whose shape depends on the endpoint; tests read fields directly and assert on them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

interface RequestOptions {
  token?: string;
  body?: unknown;
}

async function call(method: string, path: string, { token, body }: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
}

function assertRejected(res: Response, status: number, code: string): void {
  assert.equal(res.status, status, JSON.stringify(res.body));
  assert.equal(res.body.error.code, code);
}

async function signIn(phone: string): Promise<string> {
  const res = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password: seededPassword } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.accessToken;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://localhost:${port}`;
  // Test keys of its own, so the run never depends on a developer's keys/.
  keysDir = mkdtempSync(path.join(tmpdir(), 'nearby-e2e-'));
  const codeHmacKeyFile = path.join(keysDir, 'code-hmac.key');
  writeFileSync(codeHmacKeyFile, randomBytes(32).toString('base64url'));
  const jwtKeysFile = path.join(keysDir, 'jwt-keys.json');
  const jwk = { kty: 'oct', alg: 'HS256', kid: 'e2e', k: randomBytes(32).toString('base64url') };
  writeFileSync(jwtKeysFile, JSON.stringify({ keys: [jwk] }));
  // Production mode so the run does not rewrite the committed OpenAPI spec.
  server = spawn(process.execPath, ['dist/api/main.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      CODE_HMAC_KEY_FILE: codeHmacKeyFile,
      JWT_KEYS_FILE: jwtKeysFile,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`The API exited with code ${server.exitCode}; run npm run build first`);
    }
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) {
        break;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (Date.now() >= deadline) {
    throw new Error('The API did not start within 15 s');
  }
  tokens.user = await signIn(phones.user);
});

after(() => {
  server?.kill();
  rmSync(keysDir, { recursive: true, force: true });
});

describe('POST /api/v1/listings', () => {
  test('rejects a listing about a cancelled event with 422', async () => {
    const res = await call('POST', '/api/v1/listings', {
      token: tokens.user,
      body: { ...newListing, eventId: cancelledFilmEvent },
    });
    assertRejected(res, 422, 'EVENT_CANCELLED');
  });
});

describe('DELETE /api/v1/listings/{id}', () => {
  test('answers 404 to someone who is not the author, and the listing stays', async () => {
    const created = await call('POST', '/api/v1/listings', { token: tokens.user, body: newListing });
    const otherUser = await signIn(phones.otherUser);
    const res = await call('DELETE', `/api/v1/listings/${created.body.id}`, { token: otherUser });
    assertRejected(res, 404, 'NOT_FOUND');
    const stillThere = await call('GET', `/api/v1/listings/${created.body.id}`, { token: tokens.user });
    assert.equal(stillThere.status, 200);
  });
});
