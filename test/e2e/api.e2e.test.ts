// Written with the help of Claude
// End-to-end tests: start the built API (dist/) and call every endpoint over HTTP.
// For each endpoint, one request with valid input and one the API must reject.
// Run with `npm run test:e2e`, which builds first.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

// Ids from src/infra/stubs/data.ts.
const cinema = '0b6f2d4a-8c1e-4a3b-9d5f-7e2a4c6b8d01';
const exhibitions = '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02';
const poetrySlams = '3e9c5a7d-1f4b-4d6e-8a8c-0b5d7f9e1a04';
const filmClubVenue = '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05';
const filmNight = '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10';
const olenasListing = '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09';

const newEvent = {
  title: 'Film quiz night',
  description: 'Teams of up to four.',
  categoryId: cinema,
  venueId: filmClubVenue,
  startsAt: '2026-10-25T19:00:00+03:00',
  endsAt: '2026-10-25T21:00:00+03:00',
};

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

function assertInvalid(res: Response, location: string, field: string): void {
  assertRejected(res, 400, 'VALIDATION_ERROR');
  assert.ok(
    res.body.error.details.some(
      (issue: { location: string; field: string }) => issue.location === location && issue.field === field,
    ),
    JSON.stringify(res.body.error.details),
  );
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
  const jwtKey = { kty: 'oct', alg: 'HS256', kid: 'e2e', k: randomBytes(32).toString('base64url') };
  writeFileSync(jwtKeysFile, JSON.stringify({ keys: [jwtKey] }));
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
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The API did not start within 15 s');
});

after(() => {
  server?.kill();
  rmSync(keysDir, { recursive: true, force: true });
});

describe('GET /health', () => {
  test('reports ok without a token', async () => {
    const res = await call('GET', '/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  // Public and without input, so neither 400 nor 401 applies; an unsupported method is the wrong request.
  test('rejects an unsupported method with 404', async () => {
    const res = await call('POST', '/health');
    assertRejected(res, 404, 'NOT_FOUND');
    assert.equal(res.body.error.message, 'Not found');
  });
});

describe('GET /api/v1/categories', () => {
  test('lists active categories for a guest', async () => {
    const res = await call('GET', '/api/v1/categories', { token: 'stub-guest' });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.some((category: { id: string }) => category.id === cinema));
    assert.ok(!res.body.items.some((category: { id: string }) => category.id === poetrySlams));
  });

  test('rejects a request without a token with 401', async () => {
    assertRejected(await call('GET', '/api/v1/categories'), 401, 'UNAUTHENTICATED');
  });
});

describe('GET /api/v1/events', () => {
  test('returns a page of events', async () => {
    const res = await call('GET', '/api/v1/events?limit=5', { token: 'stub-guest' });
    assert.equal(res.status, 200);
    assert.equal(res.body.page.limit, 5);
    assert.ok(Array.isArray(res.body.items));
  });

  test('rejects a limit above 20 with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/events?limit=100', { token: 'stub-guest' }), 'query', 'limit');
  });
});

describe('GET /api/v1/events/{id}', () => {
  test('returns the event', async () => {
    const res = await call('GET', `/api/v1/events/${filmNight}`, { token: 'stub-guest' });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, filmNight);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/events/not-a-uuid', { token: 'stub-guest' }), 'params', 'id');
  });
});

describe('POST /api/v1/events', () => {
  test('publishes an event for a verified organization', async () => {
    const res = await call('POST', '/api/v1/events', { token: 'stub-org', body: newEvent });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, newEvent.title);
    assert.equal(res.headers.get('location'), `/api/v1/events/${res.body.id}`);
  });

  test('rejects a body without a title with 400', async () => {
    const { title: _title, ...body } = newEvent;
    assertInvalid(await call('POST', '/api/v1/events', { token: 'stub-org', body }), 'body', 'title');
  });

  test('rejects an unknown body field with 400 without naming it', async () => {
    const body = { ...newEvent, status: 'cancelled' };
    const res = await call('POST', '/api/v1/events', { token: 'stub-org', body });
    assertInvalid(res, 'body', '');
    assert.doesNotMatch(JSON.stringify(res.body), /status/);
  });
});

describe('PATCH /api/v1/events/{id}', () => {
  test('updates the organization’s own event', async () => {
    const res = await call('PATCH', `/api/v1/events/${filmNight}`, {
      token: 'stub-org',
      body: { title: 'Open-air film night (updated)' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Open-air film night (updated)');
  });

  test('rejects an empty title with 400', async () => {
    const res = await call('PATCH', `/api/v1/events/${filmNight}`, { token: 'stub-org', body: { title: '' } });
    assertInvalid(res, 'body', 'title');
  });
});

describe('POST /api/v1/events/{id}/cancel', () => {
  test('cancels the organization’s own event', async () => {
    const created = await call('POST', '/api/v1/events', { token: 'stub-org', body: newEvent });
    const res = await call('POST', `/api/v1/events/${created.body.id}/cancel`, { token: 'stub-org' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('POST', '/api/v1/events/not-a-uuid/cancel', { token: 'stub-org' }), 'params', 'id');
  });
});

describe('GET /api/v1/listings', () => {
  test('returns a page of listings', async () => {
    const res = await call('GET', '/api/v1/listings', { token: 'stub-user' });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length > 0);
  });

  test('rejects a negative offset with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/listings?offset=-1', { token: 'stub-user' }), 'query', 'offset');
  });
});

describe('GET /api/v1/listings/{id}', () => {
  test('returns the listing', async () => {
    const res = await call('GET', `/api/v1/listings/${olenasListing}`, { token: 'stub-user' });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, olenasListing);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/listings/not-a-uuid', { token: 'stub-user' }), 'params', 'id');
  });
});

describe('POST /api/v1/listings', () => {
  test('posts a listing', async () => {
    const res = await call('POST', '/api/v1/listings', { token: 'stub-user', body: newListing });
    assert.equal(res.status, 201);
    assert.equal(res.body.author.username, 'olena_k');
    assert.equal(res.headers.get('location'), `/api/v1/listings/${res.body.id}`);
  });

  test('rejects a malformed date with 400', async () => {
    const res = await call('POST', '/api/v1/listings', {
      token: 'stub-user',
      body: { ...newListing, date: '20.10.2026' },
    });
    assertInvalid(res, 'body', 'date');
  });

  test('rejects a date in the past with 422', async () => {
    const res = await call('POST', '/api/v1/listings', {
      token: 'stub-user',
      body: { ...newListing, date: '2020-01-01' },
    });
    assertRejected(res, 422, 'LISTING_DATE_IN_PAST');
  });
});

describe('DELETE /api/v1/listings/{id}', () => {
  test('removes the caller’s own listing', async () => {
    const created = await call('POST', '/api/v1/listings', { token: 'stub-user', body: newListing });
    const res = await call('DELETE', `/api/v1/listings/${created.body.id}`, { token: 'stub-user' });
    assert.equal(res.status, 204);
    assert.equal((await call('GET', `/api/v1/listings/${created.body.id}`, { token: 'stub-user' })).status, 404);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('DELETE', '/api/v1/listings/not-a-uuid', { token: 'stub-user' }), 'params', 'id');
  });
});

describe('GET /api/v1/admin/categories', () => {
  test('lists all categories, inactive ones included', async () => {
    const res = await call('GET', '/api/v1/admin/categories', { token: 'stub-admin' });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.some((category: { id: string }) => category.id === poetrySlams));
  });

  test('rejects a request without a token with 401', async () => {
    assertRejected(await call('GET', '/api/v1/admin/categories'), 401, 'UNAUTHENTICATED');
  });
});

describe('GET /api/v1/admin/categories/{id}', () => {
  test('returns the category', async () => {
    const res = await call('GET', `/api/v1/admin/categories/${cinema}`, { token: 'stub-admin' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: cinema, name: 'Cinema', isActive: true });
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/admin/categories/not-a-uuid', { token: 'stub-admin' }), 'params', 'id');
  });
});

describe('POST /api/v1/admin/categories', () => {
  test('adds a category', async () => {
    const name = `E2E ${randomUUID().slice(0, 8)}`;
    const res = await call('POST', '/api/v1/admin/categories', { token: 'stub-admin', body: { name } });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, name);
    assert.equal(res.body.isActive, true);
  });

  test('rejects an empty name with 400', async () => {
    const res = await call('POST', '/api/v1/admin/categories', { token: 'stub-admin', body: { name: '' } });
    assertInvalid(res, 'body', 'name');
  });

  test('rejects a form-encoded body with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/categories`, {
      method: 'POST',
      headers: { authorization: 'Bearer stub-admin', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Workshops',
    });
    assert.equal(res.status, 400);
  });
});

describe('PATCH /api/v1/admin/categories/{id}', () => {
  test('reactivates a category', async () => {
    const res = await call('PATCH', `/api/v1/admin/categories/${poetrySlams}`, {
      token: 'stub-admin',
      body: { isActive: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.isActive, true);
  });

  test('rejects a name longer than 60 characters with 400', async () => {
    const res = await call('PATCH', `/api/v1/admin/categories/${poetrySlams}`, {
      token: 'stub-admin',
      body: { name: 'x'.repeat(61) },
    });
    assertInvalid(res, 'body', 'name');
  });
});

describe('DELETE /api/v1/admin/categories/{id}', () => {
  test('deletes an unused category', async () => {
    const created = await call('POST', '/api/v1/admin/categories', {
      token: 'stub-admin',
      body: { name: `E2E ${randomUUID().slice(0, 8)}` },
    });
    const res = await call('DELETE', `/api/v1/admin/categories/${created.body.id}`, { token: 'stub-admin' });
    assert.equal(res.status, 204);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('DELETE', '/api/v1/admin/categories/not-a-uuid', { token: 'stub-admin' }), 'params', 'id');
  });
});
