// Written with the help of Claude
// End-to-end tests: start the built API (dist/) and call every endpoint over HTTP.
// For each endpoint, one request with valid input and one the API must reject.
// Run with `npm run test:e2e`, which builds first.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import pg from 'pg';

// Categories seeded by the seed_categories migration; the rest of the ids are from src/infra/stubs/data.ts.
// The run has a database of its own, created again every time, so no test sees rows a previous run left.
const concerts = '2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03';
const exhibitions = '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02';
const filmClubVenue = '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05';
const filmNight = '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10';
const olenasListing = '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09';
const cancelledFilmEvent = 'b8e5f1c3-2d4a-4c6b-9f0e-1a3d5c7b9e2f';
const interestFilms = 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e02';
const interestHiking = 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e15';

// Accounts from src/scripts/seed-dev-accounts.ts.
const seededPassword = 'nearby-dev-password';
const phones = {
  user: '+380501110001',
  // No other test signs in as Taras, so the password reset test can change his password.
  taras: '+380501110002',
  org: '+380501110003',
  orgPending: '+380501110004',
  admin: '+380501110005',
};

const newEvent = {
  title: 'Film quiz night',
  description: 'Teams of up to four.',
  categoryId: concerts,
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
let databaseUrl: string;
// The environment every API this run starts shares: the run's own keys and Google key set.
let apiEnv: NodeJS.ProcessEnv;
let serverOutput = '';
// The test signs tokens with the server's own key to check how bad tokens are refused.
const jwtKey = { kid: 'e2e', secret: randomBytes(32) };
const tokens = { guest: '', user: '', org: '', orgPending: '', admin: '' };
// Google's keys are served by the test itself, so it can sign ID tokens the API accepts.
const googleClientId = 'nearby-e2e.apps.googleusercontent.com';
const googleKid = 'e2e-google';
let googleKey: CryptoKey;
let jwksServer: Server;

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

/** A category of the test's own, so no test depends on another one's categories. */
async function newCategory({ isActive = true } = {}): Promise<{ id: string; name: string }> {
  const name = `E2E ${randomUUID().slice(0, 8)}`;
  const created = await call('POST', '/api/v1/admin/categories', { token: tokens.admin, body: { name } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  if (!isActive) {
    const res = await call('PATCH', `/api/v1/admin/categories/${created.body.id}`, {
      token: tokens.admin,
      body: { isActive: false },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }
  return { id: created.body.id, name };
}

/** A random Ukrainian number, so every registration test starts fresh. */
function newPhone(): string {
  return `+38050${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
}

/** Requests a code and reads it from the server's log, which shows only the last 4 digits of the phone. */
async function requestCode(phone: string, path = '/api/v1/auth/register'): Promise<string> {
  const logged = serverOutput.length;
  const res = await call('POST', path, { body: { phone } });
  assert.equal(res.status, 202, JSON.stringify(res.body));
  const code = await loggedCode(phone, logged);
  if (!code) {
    throw new Error(`No code logged for ${phone}`);
  }
  return code;
}

/** The code logged for `phone` after `logged` characters of server output, or undefined if none came within 2 s. */
async function loggedCode(phone: string, logged: number): Promise<string | undefined> {
  const pattern = new RegExp(`for \\+380\\S*${phone.slice(-4)}: (\\d{6})`);
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const code = pattern.exec(serverOutput.slice(logged))?.[1];
    if (code) {
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return undefined;
}

/** Five wrong passwords lock `phone` for 15 minutes (SEC-007). */
async function lock(phone: string): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await call('POST', '/api/v1/auth/sign-in', { body: { phone, password: 'not-the-password' } });
  }
}

/** An ID token for `subject` as Google Sign-In returns it on the device. */
function googleIdToken(subject: string, { audience = googleClientId } = {}): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: googleKid })
    .setSubject(subject)
    .setIssuer('https://accounts.google.com')
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(googleKey);
}

/** A random Google subject id, so every test links a Google account of its own. */
function newGoogleSubject(): string {
  return String(Math.floor(Math.random() * 1e15)).padStart(21, '1');
}

/** Verifies a new number and returns its phone and registration token. */
async function newRegistrant(): Promise<{ phone: string; token: string }> {
  const phone = newPhone();
  const res = await call('POST', '/api/v1/auth/verify', { body: { phone, code: await requestCode(phone) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { phone, token: res.body.accessToken };
}

/** Registers a new number and returns its phone and access token; the account has no password yet. */
async function newAccount(): Promise<{ phone: string; token: string }> {
  const { phone, token } = await newRegistrant();
  const res = await call('POST', '/api/v1/auth/complete-registration', { token, body: { dateOfBirth: '2000-05-17' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { phone, token: res.body.accessToken };
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

/** Creates `<database>_e2e` next to the database in DATABASE_URL, dropping the one of the last run; returns its URL. */
async function freshDatabase(): Promise<string> {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) {
    throw new Error('DATABASE_URL is not set: see .env.example');
  }
  const url = new URL(devUrl);
  const name = `${url.pathname.slice(1)}_e2e`;
  const client = new pg.Client({ connectionString: devUrl });
  try {
    await client.connect();
  } catch {
    throw new Error('The database is not reachable: start it with `docker compose up -d`, then run the tests again');
  }
  try {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
  url.pathname = `/${name}`;
  return url.toString();
}

/** MAIN_DATABASE_URL pointed at the run's database: the API and the seed connect as nearby_main. */
function mainDatabaseUrl(): string {
  const mainUrl = process.env.MAIN_DATABASE_URL;
  if (!mainUrl) {
    throw new Error('MAIN_DATABASE_URL is not set: see .env.example');
  }
  const url = new URL(mainUrl);
  url.pathname = new URL(databaseUrl).pathname;
  return url.toString();
}

/** Runs `query` on the run's database, for what no endpoint can do or show. */
async function withDatabase<T>(query: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await query(client);
  } finally {
    await client.end();
  }
}

/** The `sub` claim of an access token: the account id. */
function accountIdOf(token: string): string {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sub;
}

/** Runs a setup command to the end; throws with its output if it fails. */
function runOrThrow(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`);
  }
}

/** Starts the built API on a free port with `apiEnv` and `env`; resolves once it answers /health. */
async function startApi(
  env: NodeJS.ProcessEnv,
  onOutput?: (chunk: string) => void,
): Promise<{ child: ChildProcess; url: string }> {
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const child = spawn(process.execPath, ['dist/api/main.js'], {
    env: { ...apiEnv, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  child.stdout?.on('data', (chunk: Buffer) => onOutput?.(chunk.toString()));
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`The API exited with code ${child.exitCode}; run npm run build first`);
    }
    try {
      if ((await fetch(`${url}/health`)).ok) {
        return { child, url };
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error('The API did not start within 15 s');
}

before(async () => {
  // The database URL comes from .env locally and from the environment in CI.
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
  databaseUrl = await freshDatabase();
  // Test keys of its own, so the run never depends on a developer's keys/.
  keysDir = mkdtempSync(path.join(tmpdir(), 'nearby-e2e-'));
  const keyFile = (name: string) => {
    const file = path.join(keysDir, name);
    writeFileSync(file, randomBytes(32).toString('base64url'));
    return file;
  };
  const jwtKeysFile = path.join(keysDir, 'jwt-keys.json');
  const jwk = { kty: 'oct', alg: 'HS256', kid: jwtKey.kid, k: jwtKey.secret.toString('base64url') };
  writeFileSync(jwtKeysFile, JSON.stringify({ keys: [jwk] }));
  const google = await generateKeyPair('RS256', { extractable: true });
  googleKey = google.privateKey;
  const jwks = JSON.stringify({ keys: [{ ...(await exportJWK(google.publicKey)), kid: googleKid, alg: 'RS256' }] });
  jwksServer = createHttpServer((_req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end(jwks));
  const jwksPort = await freePort();
  await new Promise<void>((resolve) => jwksServer.listen(jwksPort, resolve));
  apiEnv = {
    ...process.env,
    // Production mode so the run does not rewrite the committed OpenAPI spec.
    NODE_ENV: 'production',
    DATABASE_URL: databaseUrl,
    MAIN_DATABASE_URL: mainDatabaseUrl(),
    CODE_HMAC_KEY_FILE: keyFile('code-hmac.key'),
    CONTACT_HMAC_KEY_FILE: keyFile('contact-hmac.key'),
    DATA_ENCRYPTION_KEY_FILE: keyFile('data-encryption.key'),
    JWT_KEYS_FILE: jwtKeysFile,
    // The codes are read from the log; production switches phone codes off by default.
    MESSAGING_PROVIDER: 'console',
    GOOGLE_CLIENT_IDS: googleClientId,
    GOOGLE_JWKS_URL: `http://localhost:${jwksPort}/certs`,
    ALLOW_TEST_ADAPTERS: 'true',
  };
  runOrThrow('node_modules/.bin/prisma', ['migrate', 'deploy'], apiEnv);
  // The seed refuses production mode; the accounts are encrypted with the run's keys.
  runOrThrow(process.execPath, ['dist/scripts/seed-dev-accounts.js'], { ...apiEnv, NODE_ENV: 'test' });
  // Every test calls from the same IP, so the per-IP auth limit is lifted here and tested on its own API.
  // stdout carries the verification codes the console messaging provider logs.
  ({ child: server, url: baseUrl } = await startApi({ AUTH_RATE_LIMIT_PER_MINUTE: '10000' }, (chunk) => {
    serverOutput += chunk;
  }));
  tokens.guest = (await call('POST', '/api/v1/auth/guest')).body.accessToken;
  tokens.user = await signIn(phones.user);
  tokens.org = await signIn(phones.org);
  tokens.orgPending = await signIn(phones.orgPending);
  tokens.admin = await signIn(phones.admin);
});

// The database stays until the next run, to look into after a failure.
after(() => {
  server?.kill();
  jwksServer?.close();
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

// SA-05: every response, errors included, carries the security headers. The server runs in production mode here.
describe('Security headers', () => {
  const expected = {
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
  };

  const responses: Record<string, () => Promise<Response>> = {
    'a successful response': () => call('GET', '/health'),
    'an error response': () => call('GET', '/api/v1/events'),
    'an unknown route': () => call('GET', '/no-such-route'),
  };

  for (const [name, send] of Object.entries(responses)) {
    test(`are set on ${name}`, async () => {
      const res = await send();
      for (const [header, value] of Object.entries(expected)) {
        assert.equal(res.headers.get(header), value, header);
      }
    });
  }
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
    assert.match(res.body.refreshToken, /^[0-9a-f-]{36}\.[\w-]{43}$/);
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

  // SEC-007: six bad sign-ins; the sixth, with the right password, is refused like a wrong one.
  test('locks an account after 5 wrong passwords, answering like a wrong password', async () => {
    const { phone, token } = await newAccount();
    const password = 'a long passphrase';
    await call('PUT', '/api/v1/me/password', { token, body: { password } });
    const wrong = { phone, password: 'not-the-password' };
    for (let attempt = 1; attempt <= 5; attempt++) {
      assertRejected(await call('POST', '/api/v1/auth/sign-in', { body: wrong }), 401, 'INVALID_CREDENTIALS');
    }

    const locked = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password } });

    const wrongPassword = await call('POST', '/api/v1/auth/sign-in', { body: wrong });
    assert.equal(locked.status, wrongPassword.status);
    assert.deepEqual(locked.body, wrongPassword.body);
  });

  // TM-09: a lock stops only password sign-in.
  test('still signs a locked account in with Google', async () => {
    const { phone, token } = await newAccount();
    await call('PUT', '/api/v1/me/password', { token, body: { password: 'a long passphrase' } });
    const subject = newGoogleSubject();
    await call('PUT', '/api/v1/me/google', { token, body: { idToken: await googleIdToken(subject) } });
    await lock(phone);

    const res = await call('POST', '/api/v1/auth/google', { body: { idToken: await googleIdToken(subject) } });

    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test('rejects a body without a password with 400', async () => {
    assertInvalid(await call('POST', '/api/v1/auth/sign-in', { body: { phone: phones.user } }), 'body', 'password');
  });

  test('rejects a number that is not Ukrainian with 400', async () => {
    const res = await call('POST', '/api/v1/auth/sign-in', { body: { phone: '+15551234567', password: 'x' } });
    assertInvalid(res, 'body', 'phone');
  });
});

describe('POST /api/v1/auth/register', () => {
  // SEC-007: a 429 would show that a reset code went to the number, so that it has an account.
  test('sends a code, and within a minute answers the same but sends no other', async () => {
    const phone = newPhone();
    assert.match(await requestCode(phone), /^\d{6}$/);
    const logged = serverOutput.length;

    const res = await call('POST', '/api/v1/auth/register', { body: { phone } });

    assert.equal(res.status, 202);
    assert.equal(await loggedCode(phone, logged), undefined);
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
  test('returns a registration token that only finishing registration accepts; the code works only once', async () => {
    const phone = newPhone();
    const body = { phone, code: await requestCode(phone) };

    const res = await call('POST', '/api/v1/auth/verify', { body });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.expiresIn, 15 * 60);
    assertRejected(await call('GET', '/api/v1/listings', { token: res.body.accessToken }), 401, 'UNAUTHENTICATED');
    assertRejected(await call('POST', '/api/v1/auth/verify', { body }), 422, 'INVALID_CODE');
  });

  test('refuses even the right code after 3 wrong ones', async () => {
    const phone = newPhone();
    const code = await requestCode(phone);
    const wrong = String((Number(code) + 1) % 1e6).padStart(6, '0');
    for (let attempt = 1; attempt <= 3; attempt++) {
      assertRejected(await call('POST', '/api/v1/auth/verify', { body: { phone, code: wrong } }), 422, 'INVALID_CODE');
    }
    assertRejected(await call('POST', '/api/v1/auth/verify', { body: { phone, code } }), 422, 'INVALID_CODE');
  });

  test('refuses a registered number with 409 once the code is right', async () => {
    const res = await call('POST', '/api/v1/auth/verify', {
      body: { phone: phones.admin, code: await requestCode(phones.admin) },
    });
    assertRejected(res, 409, 'CONFLICT');
  });

  test('rejects a code that is not 6 digits with 400', async () => {
    const res = await call('POST', '/api/v1/auth/verify', { body: { phone: newPhone(), code: '12345' } });

    assertInvalid(res, 'body', 'code');
  });
});

describe('POST /api/v1/auth/complete-registration', () => {
  // SAFE-001 boundary: 18 today passes, one day short does not.
  test('activates someone who turns 18 today and signs them in', async () => {
    const { token } = await newRegistrant();

    const res = await call('POST', '/api/v1/auth/complete-registration', {
      token,
      body: { dateOfBirth: yearsAgo(18) },
    });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
  });

  test('refuses someone who turns 18 tomorrow with 422 and removes the registration', async () => {
    const { token } = await newRegistrant();

    const res = await call('POST', '/api/v1/auth/complete-registration', {
      token,
      body: { dateOfBirth: yearsAgo(18, 1) },
    });

    assertRejected(res, 422, 'UNDERAGE');
    const again = await call('POST', '/api/v1/auth/complete-registration', {
      token,
      body: { dateOfBirth: yearsAgo(30) },
    });
    assertRejected(again, 404, 'NOT_FOUND');
  });

  test('refuses a finished registration with 409', async () => {
    const { token } = await newRegistrant();
    const body = { dateOfBirth: '2000-05-17' };
    await call('POST', '/api/v1/auth/complete-registration', { token, body });

    assertRejected(await call('POST', '/api/v1/auth/complete-registration', { token, body }), 409, 'CONFLICT');
  });

  test('rejects a date of birth that is not a calendar date with 400', async () => {
    const { token } = await newRegistrant();

    const res = await call('POST', '/api/v1/auth/complete-registration', {
      token,
      body: { dateOfBirth: '2000-02-30' },
    });

    assertInvalid(res, 'body', 'dateOfBirth');
  });

  test('rejects a request without a token with 401', async () => {
    const res = await call('POST', '/api/v1/auth/complete-registration', { body: { dateOfBirth: '2000-05-17' } });

    assertRejected(res, 401, 'UNAUTHENTICATED');
  });

  test('rejects a signed-in account token with 401', async () => {
    const res = await call('POST', '/api/v1/auth/complete-registration', {
      token: tokens.user,
      body: { dateOfBirth: '2000-05-17' },
    });

    assertRejected(res, 401, 'UNAUTHENTICATED');
  });
});

describe('POST /api/v1/auth/google', () => {
  test('signs in an account that linked the Google account', async () => {
    const { token } = await newAccount();
    const subject = newGoogleSubject();
    await call('PUT', '/api/v1/me/google', { token, body: { idToken: await googleIdToken(subject) } });

    const res = await call('POST', '/api/v1/auth/google', { body: { idToken: await googleIdToken(subject) } });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
  });

  test('refuses a Google account no account linked with 401', async () => {
    const res = await call('POST', '/api/v1/auth/google', {
      body: { idToken: await googleIdToken(newGoogleSubject()) },
    });

    assertRejected(res, 401, 'INVALID_CREDENTIALS');
  });

  test('rejects a body without an ID token with 400', async () => {
    assertInvalid(await call('POST', '/api/v1/auth/google', { body: {} }), 'body', 'idToken');
  });

  test('refuses an ID token issued to another app with 401', async () => {
    const idToken = await googleIdToken(newGoogleSubject(), { audience: 'another-app' });

    assertRejected(await call('POST', '/api/v1/auth/google', { body: { idToken } }), 401, 'INVALID_CREDENTIALS');
  });
});

describe('PUT /api/v1/me/google', () => {
  test('links a Google account, and linking it again changes nothing', async () => {
    const { token } = await newAccount();
    const body = { idToken: await googleIdToken(newGoogleSubject()) };

    const first = await call('PUT', '/api/v1/me/google', { token, body });
    const again = await call('PUT', '/api/v1/me/google', { token, body });

    assert.equal(first.status, 204, JSON.stringify(first.body));
    assert.equal(again.status, 204, JSON.stringify(again.body));
  });

  test('refuses a Google account another account linked with 409', async () => {
    const subject = newGoogleSubject();
    const owner = await newAccount();
    await call('PUT', '/api/v1/me/google', { token: owner.token, body: { idToken: await googleIdToken(subject) } });
    const { token } = await newAccount();

    const res = await call('PUT', '/api/v1/me/google', { token, body: { idToken: await googleIdToken(subject) } });

    assertRejected(res, 409, 'GOOGLE_ACCOUNT_TAKEN');
  });

  test('refuses a second Google account with 409', async () => {
    const { token } = await newAccount();
    await call('PUT', '/api/v1/me/google', { token, body: { idToken: await googleIdToken(newGoogleSubject()) } });

    const res = await call('PUT', '/api/v1/me/google', {
      token,
      body: { idToken: await googleIdToken(newGoogleSubject()) },
    });

    assertRejected(res, 409, 'GOOGLE_ALREADY_LINKED');
  });

  test('rejects an ID token issued to another app with 422', async () => {
    const { token } = await newAccount();
    const idToken = await googleIdToken(newGoogleSubject(), { audience: 'another-app' });

    assertRejected(await call('PUT', '/api/v1/me/google', { token, body: { idToken } }), 422, 'INVALID_GOOGLE_TOKEN');
  });

  test('rejects a guest with 401', async () => {
    const idToken = await googleIdToken(newGoogleSubject());

    assertRejected(
      await call('PUT', '/api/v1/me/google', { token: tokens.guest, body: { idToken } }),
      401,
      'UNAUTHENTICATED',
    );
  });
});

// An API of its own with the production default, where phone codes are switched off.
describe('Phone codes switched off', () => {
  let noCodes: { child: ChildProcess; url: string };

  before(async () => {
    noCodes = await startApi({ MESSAGING_PROVIDER: '' });
  });

  after(() => {
    noCodes?.child.kill();
  });

  const codeEndpoints = [
    ['/api/v1/auth/register', 'registration'],
    ['/api/v1/auth/password-reset', 'a password reset'],
  ];

  for (const [path, flow] of codeEndpoints) {
    test(`refuses ${flow} with 503 PHONE_CODES_UNAVAILABLE`, async () => {
      const res = await fetch(noCodes.url + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phones.user }),
      });

      assert.equal(res.status, 503);
      assert.equal((await res.json()).error.code, 'PHONE_CODES_UNAVAILABLE');
    });
  }
});

// SEC-007, TM-08: an API of its own with a limit of 2, so the rest of the suite keeps its budget.
describe('Per-IP limit on the auth endpoints', () => {
  let limited: { child: ChildProcess; url: string };

  before(async () => {
    limited = await startApi({ AUTH_RATE_LIMIT_PER_MINUTE: '2' });
  });

  after(() => {
    limited?.child.kill();
  });

  function post(path: string, body?: object): Promise<globalThis.Response> {
    return fetch(limited.url + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });
  }

  test('refuses a third sign-in from one IP within a minute with 429 and Retry-After', async () => {
    const attempt = { phone: phones.user, password: 'not-the-password' };
    await post('/api/v1/auth/sign-in', attempt);
    await post('/api/v1/auth/sign-in', attempt);

    const res = await post('/api/v1/auth/sign-in', attempt);

    assert.equal(res.status, 429);
    assert.equal((await res.json()).error.code, 'RATE_LIMITED');
    assert.ok(Number(res.headers.get('retry-after')) > 0, String(res.headers.get('retry-after')));
  });

  // The limit counts a request before its body is checked, so an empty body is enough.
  const limitedEndpoints = [
    ['POST', '/api/v1/auth/register'],
    ['POST', '/api/v1/auth/verify'],
    ['POST', '/api/v1/auth/google'],
    ['POST', '/api/v1/auth/password-reset'],
    ['POST', '/api/v1/auth/password-reset/confirm'],
    ['PUT', '/api/v1/me/password'],
  ];

  for (const [method, path] of limitedEndpoints) {
    test(`refuses a third ${method} ${path} from one IP within a minute with 429`, async () => {
      const send = () =>
        fetch(limited.url + path, {
          method,
          headers: { authorization: `Bearer ${tokens.user}`, 'content-type': 'application/json' },
          body: '{}',
        });
      await send();
      await send();

      const res = await send();

      assert.equal(res.status, 429);
    });
  }

  test('does not limit guest tokens, which every app start asks for', async () => {
    const statuses = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      statuses.push((await post('/api/v1/auth/guest')).status);
    }

    assert.deepEqual(statuses, [200, 200, 200]);
  });
});

describe('POST /api/v1/auth/password-reset', () => {
  test('sends no code to a number without an account, and answers it like one with an account', async () => {
    const phone = newPhone();
    const logged = serverOutput.length;

    const res = await call('POST', '/api/v1/auth/password-reset', { body: { phone } });

    assert.equal(res.status, 202, JSON.stringify(res.body));
    assert.equal(res.body, undefined);
    assert.equal(await loggedCode(phone, logged), undefined);
  });

  test('rejects a number that is not Ukrainian with 400', async () => {
    const res = await call('POST', '/api/v1/auth/password-reset', { body: { phone: '0501234567' } });

    assertInvalid(res, 'body', 'phone');
  });
});

describe('POST /api/v1/auth/password-reset/confirm', () => {
  // SEC-007: a reset lifts the lock, so a user locked out by someone else can get back in.
  // TM-01: it also signs out whoever signed in with the old password.
  test('replaces the password, lifts a lock, ends the other sessions and signs in; the code works only once', async () => {
    const phone = phones.taras;
    const password = 'a new long passphrase';
    const earlierSession = await signIn(phone);
    await lock(phone);
    const body = { phone, code: await requestCode(phone, '/api/v1/auth/password-reset'), password };

    const res = await call('POST', '/api/v1/auth/password-reset/confirm', { body });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
    assertRejected(await call('GET', '/api/v1/listings', { token: earlierSession }), 401, 'UNAUTHENTICATED');
    assertRejected(await call('POST', '/api/v1/auth/password-reset/confirm', { body }), 422, 'INVALID_CODE');
    const oldPassword = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password: seededPassword } });
    assertRejected(oldPassword, 401, 'INVALID_CREDENTIALS');
    assert.equal((await call('POST', '/api/v1/auth/sign-in', { body: { phone, password } })).status, 200);
  });

  test('rejects a new password shorter than 8 characters with 400', async () => {
    const res = await call('POST', '/api/v1/auth/password-reset/confirm', {
      body: { phone: newPhone(), code: '123456', password: 'short' },
    });

    assertInvalid(res, 'body', 'password');
  });

  test('does not accept a registration code', async () => {
    const phone = newPhone();
    const code = await requestCode(phone);

    const res = await call('POST', '/api/v1/auth/password-reset/confirm', {
      body: { phone, code, password: 'a new long passphrase' },
    });

    assertRejected(res, 422, 'INVALID_CODE');
  });
});

describe('PUT /api/v1/me/password', () => {
  const password = 'a long passphrase';

  test('sets the first password of a new account, which then signs in with it', async () => {
    const { phone, token } = await newAccount();

    const res = await call('PUT', '/api/v1/me/password', { token, body: { password } });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    assert.equal((await call('POST', '/api/v1/auth/sign-in', { body: { phone, password } })).status, 200);
  });

  test('changes a password only with the right current one', async () => {
    const { phone, token } = await newAccount();
    await call('PUT', '/api/v1/me/password', { token, body: { password } });
    const newPassword = 'another long passphrase';

    const withoutCurrent = await call('PUT', '/api/v1/me/password', { token, body: { password: newPassword } });
    const withWrongCurrent = await call('PUT', '/api/v1/me/password', {
      token,
      body: { password: newPassword, currentPassword: 'not-the-password' },
    });
    const withCurrent = await call('PUT', '/api/v1/me/password', {
      token,
      body: { password: newPassword, currentPassword: password },
    });

    assertRejected(withoutCurrent, 422, 'WRONG_PASSWORD');
    assertRejected(withWrongCurrent, 422, 'WRONG_PASSWORD');
    assert.equal(withCurrent.status, 204, JSON.stringify(withCurrent.body));
    const signIn = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password: newPassword } });
    assert.equal(signIn.status, 200);
  });

  test('ends the other sessions of the account, but not this one', async () => {
    const { phone, token } = await newAccount();
    await call('PUT', '/api/v1/me/password', { token, body: { password } });
    const other = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password } });

    const res = await call('PUT', '/api/v1/me/password', {
      token,
      body: { password: 'another long passphrase', currentPassword: password },
    });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    assert.equal((await call('GET', '/api/v1/listings', { token })).status, 200);
    assertRejected(await call('GET', '/api/v1/listings', { token: other.body.accessToken }), 401, 'UNAUTHENTICATED');
    const refresh = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: other.body.refreshToken } });
    assertRejected(refresh, 401, 'INVALID_REFRESH_TOKEN');
  });

  // SEC-007: a stolen session must not give unlimited guesses at the password.
  test('counts wrong current passwords towards the sign-in lockout', async () => {
    const { phone, token } = await newAccount();
    await call('PUT', '/api/v1/me/password', { token, body: { password } });
    for (let attempt = 1; attempt <= 5; attempt++) {
      await call('PUT', '/api/v1/me/password', {
        token,
        body: { password: 'another long passphrase', currentPassword: 'not-the-password' },
      });
    }

    const res = await call('POST', '/api/v1/auth/sign-in', { body: { phone, password } });

    assertRejected(res, 401, 'INVALID_CREDENTIALS');
  });

  test('rejects a password shorter than 8 characters with 400', async () => {
    const { token } = await newAccount();

    assertInvalid(await call('PUT', '/api/v1/me/password', { token, body: { password: 'short' } }), 'body', 'password');
  });

  test('rejects a guest with 401', async () => {
    const res = await call('PUT', '/api/v1/me/password', { token: tokens.guest, body: { password } });

    assertRejected(res, 401, 'UNAUTHENTICATED');
  });
});

// SEC-005: sessions renew without signing in again, and end at once on sign-out.
describe('POST /api/v1/auth/refresh', () => {
  async function newSession(): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await call('POST', '/api/v1/auth/sign-in', { body: { phone: phones.user, password: seededPassword } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body;
  }

  test('returns new tokens, and the old refresh token stops working', async () => {
    const session = await newSession();

    const res = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.expiresIn, 3600);
    assert.notEqual(res.body.refreshToken, session.refreshToken);
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
  });

  test('ends the session when a refresh token is used a second time', async () => {
    const session = await newSession();
    const renewed = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });

    const reused = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });

    assertRejected(reused, 401, 'INVALID_REFRESH_TOKEN');
    const afterReuse = await call('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: renewed.body.refreshToken },
    });
    assertRejected(afterReuse, 401, 'INVALID_REFRESH_TOKEN');
    assertRejected(await call('GET', '/api/v1/listings', { token: renewed.body.accessToken }), 401, 'UNAUTHENTICATED');
  });

  // A token rotated more than once cannot be told from a guess, so any wrong secret ends the session.
  test('ends the session on a wrong secret', async () => {
    const session = await newSession();
    const [sessionId] = session.refreshToken.split('.');

    const res = await call('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: `${sessionId}.${randomBytes(32).toString('base64url')}` },
    });

    assertRejected(res, 401, 'INVALID_REFRESH_TOKEN');
    const renewed = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assertRejected(renewed, 401, 'INVALID_REFRESH_TOKEN');
  });

  test('rejects a refresh token of no session with 401', async () => {
    const refreshToken = `${randomUUID()}.${randomBytes(32).toString('base64url')}`;

    const res = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken } });

    assertRejected(res, 401, 'INVALID_REFRESH_TOKEN');
  });

  test('rejects a body without a refresh token with 400', async () => {
    assertInvalid(await call('POST', '/api/v1/auth/refresh', { body: {} }), 'body', 'refreshToken');
  });
});

describe('POST /api/v1/auth/sign-out', () => {
  test('ends this session at once and leaves the others signed in', async () => {
    const session = (
      await call('POST', '/api/v1/auth/sign-in', { body: { phone: phones.user, password: seededPassword } })
    ).body;

    const res = await call('POST', '/api/v1/auth/sign-out', { token: session.accessToken });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    assertRejected(await call('GET', '/api/v1/listings', { token: session.accessToken }), 401, 'UNAUTHENTICATED');
    const refresh = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });
    assertRejected(refresh, 401, 'INVALID_REFRESH_TOKEN');
    assert.equal((await call('GET', '/api/v1/listings', { token: tokens.user })).status, 200);
  });

  test('rejects a guest with 401', async () => {
    assertRejected(await call('POST', '/api/v1/auth/sign-out', { token: tokens.guest }), 401, 'UNAUTHENTICATED');
  });
});

// SEC-005: there is no ban endpoint yet, so the test bans the account in the database.
describe('A ban', () => {
  test('rejects the next request of a session that was signed in before', async () => {
    const { token } = await newAccount();
    assert.equal((await call('GET', '/api/v1/listings', { token })).status, 200);
    await withDatabase((client) =>
      client.query(`UPDATE accounts SET status = 'banned' WHERE id = $1`, [accountIdOf(token)]),
    );

    const res = await call('GET', '/api/v1/listings', { token });

    assertRejected(res, 401, 'UNAUTHENTICATED');
  });
});

// SEC-005: a missing, expired or tampered token gets 401. The admin endpoint shows a forged role gets nowhere.
describe('Access tokens', () => {
  const accountId = 'a0c2e4f6-8b1d-4a3c-9e5f-7b9d1f3a5c6e';
  // The session the admin signed in with before the tests.
  const adminSession = () => JSON.parse(Buffer.from(tokens.admin.split('.')[1] ?? '', 'base64url').toString()).sid;

  function token(
    claims: Record<string, unknown> = { role: 'admin', sid: adminSession() },
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
    'of a session that does not exist': () => token({ role: 'admin', sid: randomUUID() }),
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
    assert.ok(res.body.items.some((category: { id: string }) => category.id === concerts));
  });

  test('leaves out inactive categories', async () => {
    const inactive = await newCategory({ isActive: false });
    const res = await call('GET', '/api/v1/categories', { token: tokens.guest });
    assert.equal(res.status, 200);
    assert.ok(!res.body.items.some((category: { id: string }) => category.id === inactive.id));
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
    const inactive = await newCategory({ isActive: false });
    const res = await call('GET', '/api/v1/admin/categories', { token: tokens.admin });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.some((category: { id: string }) => category.id === inactive.id));
  });

  test('rejects a request without a token with 401', async () => {
    assertRejected(await call('GET', '/api/v1/admin/categories'), 401, 'UNAUTHENTICATED');
  });
});

describe('GET /api/v1/admin/categories/{id}', () => {
  test('returns the category', async () => {
    const res = await call('GET', `/api/v1/admin/categories/${concerts}`, { token: tokens.admin });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: concerts, name: 'Concerts', isActive: true });
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
    const inactive = await newCategory({ isActive: false });
    const res = await call('PATCH', `/api/v1/admin/categories/${inactive.id}`, {
      token: tokens.admin,
      body: { isActive: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.isActive, true);
  });

  test('rejects a name longer than 60 characters with 400', async () => {
    const res = await call('PATCH', `/api/v1/admin/categories/${concerts}`, {
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

describe('GET /api/v1/interests', () => {
  test('lists the interests users can pick', async () => {
    const res = await call('GET', '/api/v1/interests', { token: tokens.user });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length > 0);
    assert.ok(res.body.items.some((interest: { id: string }) => interest.id === interestFilms));
  });

  test('rejects a guest token with 401', async () => {
    assertRejected(await call('GET', '/api/v1/interests', { token: tokens.guest }), 401, 'UNAUTHENTICATED');
  });
});

describe('GET /api/v1/me/profile', () => {
  test('returns the profile with the age and isComplete', async () => {
    const res = await call('GET', '/api/v1/me/profile', { token: tokens.user });
    assert.equal(res.status, 200);
    assert.equal(res.body.username, 'olena_k');
    assert.ok(Number.isInteger(res.body.age) && res.body.age >= 18, `age ${res.body.age}`);
    assert.equal(res.body.isComplete, true);
    assert.deepEqual(
      res.body.interests.map((interest: { name: string }) => interest.name),
      ['Films', 'Drawing'],
    );
  });

  test('never returns the date of birth or the account id', async () => {
    const res = await call('GET', '/api/v1/me/profile', { token: tokens.user });
    assert.doesNotMatch(JSON.stringify(res.body), /2001|dateOfBirth|accountId/);
  });

  test('answers 404 when the account has no profile yet', async () => {
    assertRejected(await call('GET', '/api/v1/me/profile', { token: tokens.admin }), 404, 'NOT_FOUND');
  });

  test('rejects a request without a token with 401', async () => {
    assertRejected(await call('GET', '/api/v1/me/profile'), 401, 'UNAUTHENTICATED');
  });
});

describe('POST /api/v1/me/profile', () => {
  test('creates the profile and answers 201 with a Location header', async () => {
    const res = await call('POST', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { username: 'Newcomer.One', displayName: 'Newcomer' },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.headers.get('location'), '/api/v1/me/profile');
    assert.equal(res.body.username, 'Newcomer.One');
    assert.equal(res.body.communicationFormat, null);
    assert.deepEqual(res.body.interests, []);
    assert.equal(res.body.isComplete, false);
  });

  test('rejects a second profile for the same account with 409 PROFILE_EXISTS', async () => {
    const res = await call('POST', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { username: 'another_name', displayName: 'Again' },
    });
    assertRejected(res, 409, 'PROFILE_EXISTS');
  });

  test('rejects a username taken by someone else, in any case, with 409 USERNAME_TAKEN', async () => {
    const res = await call('POST', '/api/v1/me/profile', {
      token: tokens.admin,
      body: { username: 'OLENA_K', displayName: 'Impostor' },
    });
    assertRejected(res, 409, 'USERNAME_TAKEN');
    assertRejected(await call('GET', '/api/v1/me/profile', { token: tokens.admin }), 404, 'NOT_FOUND');
  });

  test('rejects a missing username and display name with 400', async () => {
    const res = await call('POST', '/api/v1/me/profile', { token: tokens.admin, body: {} });
    assertInvalid(res, 'body', 'username');
    assertInvalid(res, 'body', 'displayName');
  });

  test('rejects a username that starts with a dot or contains a space with 400', async () => {
    for (const username of ['.hidden', 'two words', 'ab']) {
      const res = await call('POST', '/api/v1/me/profile', {
        token: tokens.admin,
        body: { username, displayName: 'X' },
      });
      assertInvalid(res, 'body', 'username');
    }
  });

  test('rejects an unknown body field with 400', async () => {
    const body = { username: 'valid_name', displayName: 'X', communicationFormat: 'dating' };
    assertInvalid(await call('POST', '/api/v1/me/profile', { token: tokens.admin, body }), 'body', '');
  });
});

describe('PATCH /api/v1/me/profile', () => {
  test('changes only the fields sent', async () => {
    const res = await call('PATCH', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { description: 'Walks and films.', communicationFormat: 'dating', sharePhone: false },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.username, 'Newcomer.One');
    assert.equal(res.body.description, 'Walks and films.');
    assert.equal(res.body.communicationFormat, 'dating');
    assert.equal(res.body.sharePhone, false);
    assert.equal(res.body.isComplete, false, 'still no interests');
  });

  test('keeps the changes, so a later GET returns them', async () => {
    const patched = await call('PATCH', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { description: 'Concerts on weekdays.', sharePhone: true },
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));

    const res = await call('GET', '/api/v1/me/profile', { token: tokens.orgPending });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.description, 'Concerts on weekdays.');
    assert.equal(res.body.sharePhone, true);
    assert.equal(res.body.communicationFormat, 'dating', 'a field not sent keeps its value');
  });

  test('lets a user change the case of their own username', async () => {
    const res = await call('PATCH', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { username: 'newcomer.one' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.username, 'newcomer.one');
  });

  test('rejects a username taken by someone else with 409 USERNAME_TAKEN', async () => {
    const res = await call('PATCH', '/api/v1/me/profile', { token: tokens.orgPending, body: { username: 'taras.m' } });
    assertRejected(res, 409, 'USERNAME_TAKEN');
  });

  test('answers 404 when the profile is not created yet', async () => {
    const res = await call('PATCH', '/api/v1/me/profile', { token: tokens.admin, body: { description: 'Hi' } });
    assertRejected(res, 404, 'NOT_FOUND');
  });

  test('rejects an unknown communicationFormat with 400', async () => {
    const res = await call('PATCH', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { communicationFormat: 'party' },
    });
    assertInvalid(res, 'body', 'communicationFormat');
  });

  test('rejects an empty body with 400', async () => {
    assertRejected(
      await call('PATCH', '/api/v1/me/profile', { token: tokens.orgPending, body: {} }),
      400,
      'VALIDATION_ERROR',
    );
  });

  test('rejects a request without a token with 401', async () => {
    assertRejected(await call('PATCH', '/api/v1/me/profile', { body: { description: 'Hi' } }), 401, 'UNAUTHENTICATED');
  });
});

describe('PUT /api/v1/me/profile/interests', () => {
  test('replaces the whole set and completes the profile', async () => {
    const first = await call('PUT', '/api/v1/me/profile/interests', {
      token: tokens.orgPending,
      body: { interestIds: [interestFilms, interestHiking, interestFilms] },
    });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.interests.length, 2, 'a repeated id counts once');
    assert.equal(first.body.isComplete, true, 'format and interests are both set');

    const second = await call('PUT', '/api/v1/me/profile/interests', {
      token: tokens.orgPending,
      body: { interestIds: [interestHiking] },
    });
    assert.deepEqual(
      second.body.interests.map((interest: { id: string }) => interest.id),
      [interestHiking],
    );
  });

  test('an empty list clears the interests and the profile is incomplete again', async () => {
    const res = await call('PUT', '/api/v1/me/profile/interests', {
      token: tokens.orgPending,
      body: { interestIds: [] },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.interests, []);
    assert.equal(res.body.isComplete, false);
  });

  test('rejects an unknown interest id with 422 and changes nothing', async () => {
    await call('PUT', '/api/v1/me/profile/interests', {
      token: tokens.orgPending,
      body: { interestIds: [interestFilms] },
    });
    const res = await call('PUT', '/api/v1/me/profile/interests', {
      token: tokens.orgPending,
      body: { interestIds: [interestHiking, randomUUID()] },
    });
    assertRejected(res, 422, 'REFERENCE_NOT_FOUND');
    const profile = await call('GET', '/api/v1/me/profile', { token: tokens.orgPending });
    assert.deepEqual(
      profile.body.interests.map((interest: { id: string }) => interest.id),
      [interestFilms],
    );
  });

  test('answers 404 when the profile is not created yet', async () => {
    const res = await call('PUT', '/api/v1/me/profile/interests', { token: tokens.admin, body: { interestIds: [] } });
    assertRejected(res, 404, 'NOT_FOUND');
  });

  test('rejects ids that are not UUIDs with 400', async () => {
    const res = await call('PUT', '/api/v1/me/profile/interests', {
      token: tokens.orgPending,
      body: { interestIds: ['cinema'] },
    });
    assertInvalid(res, 'body', 'interestIds.0');
  });
});

// SEC-003: the columns hold ciphertext; the API never shows them, so the test reads them directly.
describe('Personal data at rest', () => {
  test('stores the phone number and the date of birth only encrypted', async () => {
    const { phone, token } = await newAccount();

    const { account, codes } = await withDatabase(async (client) => {
      const accounts = await client.query(
        'SELECT contact_identifier, contact_hash, date_of_birth FROM accounts WHERE id = $1',
        [accountIdOf(token)],
      );
      const sent = await client.query('SELECT contact FROM verification_codes WHERE contact_hash = $1', [
        accounts.rows[0]?.contact_hash,
      ]);
      return { account: accounts.rows[0], codes: sent.rows };
    });

    // newAccount registers with this date of birth.
    const secrets = [phone, phone.slice(1), '2000-05-17'];
    const stored = [
      account.contact_identifier,
      account.contact_hash,
      account.date_of_birth,
      ...codes.map((c) => c.contact),
    ];
    assert.equal(codes.length, 1);
    for (const value of stored) {
      assert.ok(Buffer.isBuffer(value));
      for (const secret of secrets) {
        assert.equal(value.includes(secret), false, `a stored value contains ${secret}`);
      }
    }
  });
});

// The locks and conditional updates in the repositories, which the unit tests mock and one request at a time never reaches.
describe('Parallel requests', () => {
  const parallel = <T>(times: number, request: () => Promise<T>) => Promise.all(Array.from({ length: times }, request));

  // On one database connection the requests would run one after another and never race.
  const openConnections = () => parallel(10, () => call('GET', '/api/v1/categories', { token: tokens.guest }));

  // SEC-008
  test('send one code when one number registers 10 times at once', async () => {
    const phone = newPhone();
    await openConnections();
    const logged = serverOutput.length;

    const responses = await parallel(10, () => call('POST', '/api/v1/auth/register', { body: { phone } }));

    assert.ok(responses.every((res) => res.status === 202));
    const codes = serverOutput.slice(logged).match(new RegExp(`for \\+380\\S*${phone.slice(-4)}: \\d{6}`, 'g'));
    assert.equal(codes?.length, 1);
  });

  // SEC-005
  test('renew a session once when one refresh token is sent 5 times at once', async () => {
    const { body: session } = await call('POST', '/api/v1/auth/sign-in', {
      body: { phone: phones.user, password: seededPassword },
    });
    await openConnections();

    const responses = await parallel(5, () =>
      call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } }),
    );

    assert.equal(responses.filter((res) => res.status === 200).length, 1);
  });

  // SEC-007: five failures lock the account only if no one overwrites another.
  test('lock an account after 5 wrong passwords sent at once', async () => {
    const { phone, token } = await newAccount();
    const password = 'a long passphrase';
    await call('PUT', '/api/v1/me/password', { token, body: { password } });

    await parallel(5, () => call('POST', '/api/v1/auth/sign-in', { body: { phone, password: 'not-the-password' } }));

    assertRejected(
      await call('POST', '/api/v1/auth/sign-in', { body: { phone, password } }),
      401,
      'INVALID_CREDENTIALS',
    );
  });

  // Both requests can pass the service's checks; then the unique index stops one, with the same answer.
  test('link one Google account to only one of two accounts asking at once', async () => {
    const subject = newGoogleSubject();
    const [first, second] = [await newAccount(), await newAccount()];

    const responses = await Promise.all(
      [first, second].map(async ({ token }) =>
        call('PUT', '/api/v1/me/google', { token, body: { idToken: await googleIdToken(subject) } }),
      ),
    );

    const statuses = responses.map((res) => res.status).sort();
    assert.deepEqual(statuses, [204, 409], JSON.stringify(responses.map((res) => res.body)));
    assert.equal(responses.find((res) => res.status === 409)?.body.error.code, 'GOOGLE_ACCOUNT_TAKEN');
  });

  test('link only one of two Google accounts one account sends at once', async () => {
    const { token } = await newAccount();

    const responses = await parallel(2, async () =>
      call('PUT', '/api/v1/me/google', { token, body: { idToken: await googleIdToken(newGoogleSubject()) } }),
    );

    const statuses = responses.map((res) => res.status).sort();
    assert.deepEqual(statuses, [204, 409], JSON.stringify(responses.map((res) => res.body)));
    assert.equal(responses.find((res) => res.status === 409)?.body.error.code, 'GOOGLE_ALREADY_LINKED');
  });
});

// SEC-002, SEC-004: last, so the log holds what every test above did.
describe('Server log', () => {
  test('contains no password or access token', () => {
    const passwords = [seededPassword, 'a long passphrase', 'a new long passphrase', 'another long passphrase'];
    const secrets = [...passwords, 'not-the-password', ...Object.values(tokens)];

    for (const secret of secrets) {
      assert.equal(serverOutput.includes(secret), false, `the log contains ${secret.slice(0, 12)}…`);
    }
  });
});
