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
import { SignJWT } from 'jose';

// Ids from src/infra/stubs/data.ts.
const cinema = '0b6f2d4a-8c1e-4a3b-9d5f-7e2a4c6b8d01';
const exhibitions = '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02';
const poetrySlams = '3e9c5a7d-1f4b-4d6e-8a8c-0b5d7f9e1a04';
const filmClubVenue = '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05';
const filmNight = '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10';
const olenasListing = '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09';
const cancelledFilmEvent = 'b8e5f1c3-2d4a-4c6b-9f0e-1a3d5c7b9e2f';

// Seeded accounts from src/infra/stubs/data.ts.
const seededPassword = 'nearby-dev-password';
const phones = { user: '+380501110001', org: '+380501110003', orgPending: '+380501110004', admin: '+380501110005' };

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
let serverOutput = '';
// The test signs tokens with the server's own key to check how bad tokens are refused.
const jwtKey = { kid: 'e2e', secret: randomBytes(32) };
const tokens = { guest: '', user: '', org: '', orgPending: '', admin: '' };

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

async function signIn(phone: string): Promise<string> {
  const res = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password: seededPassword } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.accessToken;
}

/** A random Ukrainian number, so every registration test starts fresh. */
function newPhone(): string {
  return `+38050${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
}

/** Requests a code and reads it from the server's log, which shows only the last 4 digits of the phone. */
async function requestCode(phone: string): Promise<string> {
  const logged = serverOutput.length;
  const res = await call('POST', '/api/v1/auth/register', { body: { phone } });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  const pattern = new RegExp(`for \\+380\\S*${phone.slice(-4)}: (\\d{6})`);
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const code = pattern.exec(serverOutput.slice(logged))?.[1];
    if (code) {
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No code logged for ${phone}`);
}

function registration(phone: string, code: string, dateOfBirth = '2000-05-17') {
  return { phone, code, password: 'a long passphrase', dateOfBirth };
}

/** Kyiv date `years` years before today. */
function yearsAgo(years: number, plusDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(Date.now());
  const date = new Date(`${Number(today.slice(0, 4)) - years}${today.slice(4)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + plusDays);
  return date.toISOString().slice(0, 10);
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
  const jwk = { kty: 'oct', alg: 'HS256', kid: jwtKey.kid, k: jwtKey.secret.toString('base64url') };
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
    // stdout carries the verification codes the console messaging provider logs.
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  server.stdout?.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString();
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
  tokens.guest = (await call('POST', '/api/v1/auth/guest')).body.accessToken;
  tokens.user = await signIn(phones.user);
  tokens.org = await signIn(phones.org);
  tokens.orgPending = await signIn(phones.orgPending);
  tokens.admin = await signIn(phones.admin);
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

describe('POST /api/v1/auth/guest', () => {
  test('returns a guest token that reads the catalog but not listings', async () => {
    const res = await call('POST', '/api/v1/auth/guest');
    assert.equal(res.status, 200);
    assert.equal(res.body.tokenType, 'Bearer');
    assert.equal(res.body.expiresIn, 3600);
    assert.equal((await call('GET', '/api/v1/categories', { token: res.body.accessToken })).status, 200);
    assertRejected(await call('GET', '/api/v1/listings', { token: res.body.accessToken }), 401, 'UNAUTHENTICATED');
  });
});

describe('POST /api/v1/auth/sign-in', () => {
  test('returns an access token for the account', async () => {
    const res = await call('POST', '/api/v1/auth/sign-in', { body: { phone: phones.user, password: seededPassword } });
    assert.equal(res.status, 200);
    assert.equal(res.body.tokenType, 'Bearer');
    assert.equal(res.body.expiresIn, 3600);
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
  });

  test('answers a wrong password and an unknown phone alike with 401', async () => {
    const wrongPassword = await call('POST', '/api/v1/auth/sign-in', {
      body: { phone: phones.user, password: 'not-the-password' },
    });
    const unknownPhone = await call('POST', '/api/v1/auth/sign-in', {
      body: { phone: newPhone(), password: 'not-the-password' },
    });
    assertRejected(wrongPassword, 401, 'INVALID_CREDENTIALS');
    assert.deepEqual(unknownPhone.body, wrongPassword.body);
    assert.equal(unknownPhone.status, wrongPassword.status);
  });

  test('rejects a number that is not Ukrainian with 400', async () => {
    const res = await call('POST', '/api/v1/auth/sign-in', { body: { phone: '+15551234567', password: 'x' } });
    assertInvalid(res, 'body', 'phone');
  });
});

describe('POST /api/v1/auth/register', () => {
  test('sends a code, and refuses another within a minute with 429', async () => {
    const phone = newPhone();
    assert.match(await requestCode(phone), /^\d{6}$/);
    assertRejected(await call('POST', '/api/v1/auth/register', { body: { phone } }), 429, 'CODE_RESEND_TOO_SOON');
  });

  test('answers a registered number the same as a new one', async () => {
    const res = await call('POST', '/api/v1/auth/register', { body: { phone: phones.org } });
    assert.equal(res.status, 202);
    assert.equal(res.body, undefined);
  });

  test('rejects a number that is not Ukrainian with 400', async () => {
    assertInvalid(await call('POST', '/api/v1/auth/register', { body: { phone: '0501234567' } }), 'body', 'phone');
  });
});

describe('POST /api/v1/auth/verify', () => {
  test('creates the account and signs in; the code works only once', async () => {
    const phone = newPhone();
    const body = registration(phone, await requestCode(phone));
    const res = await call('POST', '/api/v1/auth/verify', { body });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
    assertRejected(await call('POST', '/api/v1/auth/verify', { body }), 422, 'INVALID_CODE');
    const signIn = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password: body.password } });
    assert.equal(signIn.status, 200);
  });

  test('refuses even the right code after 3 wrong ones', async () => {
    const phone = newPhone();
    const code = await requestCode(phone);
    const wrong = String((Number(code) + 1) % 1e6).padStart(6, '0');
    for (let attempt = 1; attempt <= 3; attempt++) {
      assertRejected(
        await call('POST', '/api/v1/auth/verify', { body: registration(phone, wrong) }),
        422,
        'INVALID_CODE',
      );
    }
    assertRejected(await call('POST', '/api/v1/auth/verify', { body: registration(phone, code) }), 422, 'INVALID_CODE');
  });

  // SAFE-001 boundary: 18 today passes, one day short does not.
  test('accepts someone who turns 18 today', async () => {
    const phone = newPhone();
    const res = await call('POST', '/api/v1/auth/verify', {
      body: registration(phone, await requestCode(phone), yearsAgo(18)),
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('refuses someone who turns 18 tomorrow with 422', async () => {
    const phone = newPhone();
    const res = await call('POST', '/api/v1/auth/verify', {
      body: registration(phone, await requestCode(phone), yearsAgo(18, 1)),
    });
    assertRejected(res, 422, 'UNDERAGE');
  });

  test('refuses a registered number with 409 once the code is right', async () => {
    const res = await call('POST', '/api/v1/auth/verify', {
      body: registration(phones.admin, await requestCode(phones.admin)),
    });
    assertRejected(res, 409, 'CONFLICT');
  });

  test('rejects a password shorter than 8 characters with 400', async () => {
    const res = await call('POST', '/api/v1/auth/verify', {
      body: { ...registration(newPhone(), '123456'), password: 'short' },
    });
    assertInvalid(res, 'body', 'password');
  });
});

// SEC-005: a missing, expired or tampered token gets 401. The admin endpoint shows a forged role gets nowhere.
describe('Access tokens', () => {
  const accountId = 'a0c2e4f6-8b1d-4a3c-9e5f-7b9d1f3a5c6e';

  function token(
    claims: Record<string, unknown> = { role: 'admin', sid: randomUUID() },
    { header = {}, secret = jwtKey.secret, audience = 'nearby-api', expiresIn = '1h' } = {},
  ): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256', kid: jwtKey.kid, typ: 'at+jwt', ...header })
      .setSubject(accountId)
      .setIssuer('nearby-api')
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secret);
  }

  test('accepts a token signed the way the server signs', async () => {
    assert.equal((await call('GET', '/api/v1/admin/categories', { token: await token() })).status, 200);
  });

  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

  const badTokens: Record<string, () => Promise<string>> = {
    expired: () => token(undefined, { expiresIn: '-1s' }),
    'with a tampered role': async () => {
      const [header, payload = '', signature] = tokens.user.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return `${header}.${encode({ ...claims, role: 'admin' })}.${signature}`;
    },
    'with alg none': async () => {
      const [, payload] = (await token()).split('.');
      return `${encode({ alg: 'none', typ: 'at+jwt', kid: jwtKey.kid })}.${payload}.`;
    },
    'signed with another key': () => token(undefined, { secret: randomBytes(32) }),
    'with an unknown kid': () => token(undefined, { header: { kid: 'unknown' } }),
    'for another audience': () => token(undefined, { audience: 'another-api' }),
    'that is not an access token': () => token(undefined, { header: { typ: 'JWT' } }),
    'of an account without a session': () => token({ role: 'admin' }),
    'that is not a JWT': async () => 'not-a-token',
    // SA-01: inherited object keys were once accepted as tokens.
    'named like an object property': async () => 'constructor',
  };

  for (const [name, make] of Object.entries(badTokens)) {
    test(`rejects a token ${name} with 401`, async () => {
      assertRejected(await call('GET', '/api/v1/admin/categories', { token: await make() }), 401, 'UNAUTHENTICATED');
    });
  }
});

describe('GET /api/v1/categories', () => {
  test('lists active categories for a guest', async () => {
    const res = await call('GET', '/api/v1/categories', { token: tokens.guest });
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
    const res = await call('GET', '/api/v1/events?limit=5', { token: tokens.guest });
    assert.equal(res.status, 200);
    assert.equal(res.body.page.limit, 5);
    assert.ok(Array.isArray(res.body.items));
  });

  test('rejects a limit above 20 with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/events?limit=100', { token: tokens.guest }), 'query', 'limit');
  });
});

describe('GET /api/v1/events/{id}', () => {
  test('returns the event', async () => {
    const res = await call('GET', `/api/v1/events/${filmNight}`, { token: tokens.guest });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, filmNight);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/events/not-a-uuid', { token: tokens.guest }), 'params', 'id');
  });
});

describe('POST /api/v1/events', () => {
  test('publishes an event for a verified organization', async () => {
    const res = await call('POST', '/api/v1/events', { token: tokens.org, body: newEvent });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, newEvent.title);
    assert.equal(res.headers.get('location'), `/api/v1/events/${res.body.id}`);
  });

  test('rejects an organization that is not verified with 422', async () => {
    const res = await call('POST', '/api/v1/events', { token: tokens.orgPending, body: newEvent });
    assertRejected(res, 422, 'ORGANIZATION_NOT_VERIFIED');
  });

  test('rejects an account that is not an organization with 422', async () => {
    const res = await call('POST', '/api/v1/events', { token: tokens.user, body: newEvent });
    assertRejected(res, 422, 'ORGANIZATION_NOT_VERIFIED');
  });

  test('rejects a guest token with 401', async () => {
    assertRejected(
      await call('POST', '/api/v1/events', { token: tokens.guest, body: newEvent }),
      401,
      'UNAUTHENTICATED',
    );
  });

  test('rejects a body without a title with 400', async () => {
    const { title: _title, ...body } = newEvent;
    assertInvalid(await call('POST', '/api/v1/events', { token: tokens.org, body }), 'body', 'title');
  });

  test('names every invalid field with one details entry each', async () => {
    const { title: _title, venueId: _venueId, ...rest } = newEvent;
    const res = await call('POST', '/api/v1/events', { token: tokens.org, body: { ...rest, startsAt: 'tomorrow' } });
    assertInvalid(res, 'body', 'title');
    assertInvalid(res, 'body', 'venueId');
    assertInvalid(res, 'body', 'startsAt');
    assert.equal(res.body.error.details.length, 3, JSON.stringify(res.body.error.details));
  });

  test('rejects an event that ends before it starts with 422', async () => {
    const body = { ...newEvent, endsAt: '2026-10-25T18:00:00+03:00' };
    assertRejected(await call('POST', '/api/v1/events', { token: tokens.org, body }), 422, 'EVENT_ENDS_BEFORE_START');
  });

  test('rejects an unknown body field with 400 without naming it', async () => {
    const body = { ...newEvent, status: 'cancelled' };
    const res = await call('POST', '/api/v1/events', { token: tokens.org, body });
    assertInvalid(res, 'body', '');
    assert.doesNotMatch(JSON.stringify(res.body), /status/);
  });
});

describe('PUT /api/v1/events/{id}', () => {
  const replacement = { ...newEvent, title: 'Open-air film night (updated)', description: 'New description.' };

  test('replaces the editable fields of the organization’s own event', async () => {
    const res = await call('PUT', `/api/v1/events/${filmNight}`, { token: tokens.org, body: replacement });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.id, filmNight);
    assert.equal(res.body.title, replacement.title);
    assert.equal(res.body.description, replacement.description);
    assert.equal(res.body.startsAt, replacement.startsAt);
    assert.equal(res.body.status, 'published');
  });

  test('does not accept PATCH any more: the route is gone', async () => {
    const res = await call('PATCH', `/api/v1/events/${filmNight}`, { token: tokens.org, body: { title: 'X' } });
    assertRejected(res, 404, 'NOT_FOUND');
  });

  test('answers 404 to an organization that did not post the event', async () => {
    const res = await call('PUT', `/api/v1/events/${filmNight}`, { token: tokens.orgPending, body: replacement });
    assertRejected(res, 404, 'NOT_FOUND');
  });

  test('answers 404 to a regular user, like for a missing event', async () => {
    const own = await call('PUT', `/api/v1/events/${filmNight}`, { token: tokens.user, body: replacement });
    const missing = await call('PUT', `/api/v1/events/${randomUUID()}`, { token: tokens.org, body: replacement });
    assertRejected(own, 404, 'NOT_FOUND');
    assertRejected(missing, 404, 'NOT_FOUND');
  });

  test('rejects editing a cancelled event with 422', async () => {
    const res = await call('PUT', `/api/v1/events/${cancelledFilmEvent}`, { token: tokens.org, body: replacement });
    assertRejected(res, 422, 'EVENT_CANCELLED');
  });

  test('rejects an empty title with 400', async () => {
    const res = await call('PUT', `/api/v1/events/${filmNight}`, {
      token: tokens.org,
      body: { ...replacement, title: '' },
    });
    assertInvalid(res, 'body', 'title');
  });

  test('rejects a body with missing fields with 400, one details entry per field', async () => {
    const res = await call('PUT', `/api/v1/events/${filmNight}`, {
      token: tokens.org,
      body: { title: 'Only a title' },
    });
    for (const field of ['description', 'categoryId', 'venueId', 'startsAt', 'endsAt']) {
      assertInvalid(res, 'body', field);
    }
    assert.equal(res.body.error.details.length, 5, JSON.stringify(res.body.error.details));
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(
      await call('PUT', '/api/v1/events/not-a-uuid', { token: tokens.org, body: replacement }),
      'params',
      'id',
    );
  });

  test('rejects a venue that is not the organization’s own with 422', async () => {
    const body = { ...replacement, venueId: '6b2d4f6a-8c0e-4a2b-9d4f-6a8b0c2e4f06' };
    assertRejected(
      await call('PUT', `/api/v1/events/${filmNight}`, { token: tokens.org, body }),
      422,
      'REFERENCE_NOT_FOUND',
    );
  });

  test('rejects a status field with 400: PUT cannot cancel', async () => {
    const body = { ...replacement, status: 'cancelled' };
    assertInvalid(await call('PUT', `/api/v1/events/${filmNight}`, { token: tokens.org, body }), 'body', '');
  });
});

describe('POST /api/v1/events/{id}/cancel', () => {
  test('cancels the organization’s own event', async () => {
    const created = await call('POST', '/api/v1/events', { token: tokens.org, body: newEvent });
    const res = await call('POST', `/api/v1/events/${created.body.id}/cancel`, { token: tokens.org });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('POST', '/api/v1/events/not-a-uuid/cancel', { token: tokens.org }), 'params', 'id');
  });
});

describe('GET /api/v1/listings', () => {
  test('returns a page of listings', async () => {
    const res = await call('GET', '/api/v1/listings', { token: tokens.user });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length > 0);
  });

  test('rejects a negative offset with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/listings?offset=-1', { token: tokens.user }), 'query', 'offset');
  });
});

describe('GET /api/v1/listings/{id}', () => {
  test('returns the listing', async () => {
    const res = await call('GET', `/api/v1/listings/${olenasListing}`, { token: tokens.user });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, olenasListing);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/listings/not-a-uuid', { token: tokens.user }), 'params', 'id');
  });
});

describe('POST /api/v1/listings', () => {
  test('posts a listing', async () => {
    const res = await call('POST', '/api/v1/listings', { token: tokens.user, body: newListing });
    assert.equal(res.status, 201);
    assert.equal(res.body.author.username, 'olena_k');
    assert.equal(res.headers.get('location'), `/api/v1/listings/${res.body.id}`);
  });

  test('rejects a malformed date with 400', async () => {
    const res = await call('POST', '/api/v1/listings', {
      token: tokens.user,
      body: { ...newListing, date: '20.10.2026' },
    });
    assertInvalid(res, 'body', 'date');
  });

  test('rejects a date in the past with 422', async () => {
    const res = await call('POST', '/api/v1/listings', {
      token: tokens.user,
      body: { ...newListing, date: '2020-01-01' },
    });
    assertRejected(res, 422, 'LISTING_DATE_IN_PAST');
  });
});

describe('DELETE /api/v1/listings/{id}', () => {
  test('removes the caller’s own listing', async () => {
    const created = await call('POST', '/api/v1/listings', { token: tokens.user, body: newListing });
    const res = await call('DELETE', `/api/v1/listings/${created.body.id}`, { token: tokens.user });
    assert.equal(res.status, 204);
    assert.equal((await call('GET', `/api/v1/listings/${created.body.id}`, { token: tokens.user })).status, 404);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('DELETE', '/api/v1/listings/not-a-uuid', { token: tokens.user }), 'params', 'id');
  });
});

describe('GET /api/v1/admin/categories', () => {
  test('lists all categories, inactive ones included', async () => {
    const res = await call('GET', '/api/v1/admin/categories', { token: tokens.admin });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.some((category: { id: string }) => category.id === poetrySlams));
  });

  test('rejects a request without a token with 401', async () => {
    assertRejected(await call('GET', '/api/v1/admin/categories'), 401, 'UNAUTHENTICATED');
  });
});

describe('GET /api/v1/admin/categories/{id}', () => {
  test('returns the category', async () => {
    const res = await call('GET', `/api/v1/admin/categories/${cinema}`, { token: tokens.admin });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: cinema, name: 'Cinema', isActive: true });
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/admin/categories/not-a-uuid', { token: tokens.admin }), 'params', 'id');
  });
});

describe('POST /api/v1/admin/categories', () => {
  test('adds a category', async () => {
    const name = `E2E ${randomUUID().slice(0, 8)}`;
    const res = await call('POST', '/api/v1/admin/categories', { token: tokens.admin, body: { name } });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, name);
    assert.equal(res.body.isActive, true);
  });

  test('rejects an empty name with 400', async () => {
    const res = await call('POST', '/api/v1/admin/categories', { token: tokens.admin, body: { name: '' } });
    assertInvalid(res, 'body', 'name');
  });

  test('rejects a form-encoded body with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/categories`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tokens.admin}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Workshops',
    });
    assert.equal(res.status, 400);
  });
});

describe('PATCH /api/v1/admin/categories/{id}', () => {
  test('reactivates a category', async () => {
    const res = await call('PATCH', `/api/v1/admin/categories/${poetrySlams}`, {
      token: tokens.admin,
      body: { isActive: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.isActive, true);
  });

  test('rejects a name longer than 60 characters with 400', async () => {
    const res = await call('PATCH', `/api/v1/admin/categories/${poetrySlams}`, {
      token: tokens.admin,
      body: { name: 'x'.repeat(61) },
    });
    assertInvalid(res, 'body', 'name');
  });
});

describe('DELETE /api/v1/admin/categories/{id}', () => {
  test('deletes an unused category', async () => {
    const created = await call('POST', '/api/v1/admin/categories', {
      token: tokens.admin,
      body: { name: `E2E ${randomUUID().slice(0, 8)}` },
    });
    const res = await call('DELETE', `/api/v1/admin/categories/${created.body.id}`, { token: tokens.admin });
    assert.equal(res.status, 204);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('DELETE', '/api/v1/admin/categories/not-a-uuid', { token: tokens.admin }), 'params', 'id');
  });
});
