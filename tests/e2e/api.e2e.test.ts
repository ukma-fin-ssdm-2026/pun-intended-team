// Written with the help of Claude
// End-to-end tests: start the built API (dist/) and call every endpoint over HTTP.
// For each endpoint, one request with valid input and one the API must reject.
// Run with `npm run test:e2e`, which builds first.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import { type AddressInfo, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import pg from 'pg';
import sharp from 'sharp';
import { ageOn } from '../../dist/core/common/age.js';
import { addDays, fromKyivWallClock, kyivDate } from '../../dist/core/common/kyiv-time.js';
import type { MessagingProvider } from '../../dist/core/notifications/adapters/messaging-provider.js';
import type { PushProvider } from '../../dist/core/notifications/adapters/push-provider.js';
import { NotificationsService } from '../../dist/core/notifications/services/notifications.service.js';
import { PgBossJobQueue } from '../../dist/infra/jobs/pg-boss-job-queue.js';
import { ImportPrismaService } from '../../dist/infra/prisma/import-prisma.service.js';
import { PersonalDataCipher } from '../../dist/infra/prisma/personal-data-cipher.js';
import { PrismaDeviceTokensRepository } from '../../dist/infra/prisma/prisma-device-tokens.repository.js';
import { PrismaImportedEventsRepository } from '../../dist/infra/prisma/prisma-imported-events.repository.js';
import { PrismaNotificationsRepository } from '../../dist/infra/prisma/prisma-notifications.repository.js';
import { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { PrismaTransactionRunner } from '../../dist/infra/prisma/prisma-transaction-runner.js';
import { ARTWIZARD_CATEGORY_SLUGS } from '../../dist/infra/providers/artwizard-event-provider.js';
import { KARABAS_SECTIONS } from '../../dist/infra/providers/karabas-event-provider.js';

// Categories seeded by the seed_categories migration; the rest of the ids are those the in-memory stubs had before #310.
// The run has a database of its own, created again every time, so no test sees rows a previous run left.
const concerts = '2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03';
const exhibitions = '1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02';
const filmClubVenue = '5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05';
const arsenalVenue = '6b2d4f6a-8c0e-4a2b-9d4f-6a8b0c2e4f06';
const newGalleryHall = '7c3e5a7b-9d1f-4b3c-8e5a-7b9c1d3f5a07';
const filmNight = '3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10';
const arsenalExhibition = 'a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e';
const olenasListing = '9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09';
const tarasListing = 'af5b7d9e-1a3c-4e5f-9b7d-9e1a3c5e7f10';
const cancelledFilmEvent = 'b8e5f1c3-2d4a-4c6b-9f0e-1a3d5c7b9e2f';
const interestFilms = 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e02';
const interestHiking = 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e15';

// The accounts the former in-memory stubs belonged to; the test creates them and signs their Google ID tokens.
const stubAccounts = {
  user: {
    id: 'c3a1f6d2-4b7e-4f0a-9d21-6e8b5a3c7f14',
    role: 'user',
    subject: '100000000000000000001',
    dateOfBirth: '2001-04-12',
  },
  org: {
    id: 'e1f3a5c7-9b2d-4f6e-8a0c-3d5f7b9e1a2c',
    role: 'user',
    subject: '100000000000000000003',
    dateOfBirth: '1990-06-21',
  },
  orgPending: {
    id: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
    role: 'user',
    subject: '100000000000000000004',
    dateOfBirth: '1995-02-08',
  },
  admin: {
    id: 'a0c2e4f6-8b1d-4a3c-9e5f-7b9d1f3a5c6e',
    role: 'admin',
    subject: '100000000000000000005',
    dateOfBirth: '1988-09-15',
  },
};
// Taras has a profile and a listing in the stubs but never signs in, so he has no sign-in method.
const tarasAccount = { id: 'd8e2b4c6-1a3f-4e5d-8b7c-9f0a2c4e6b18', dateOfBirth: '1997-11-03' };

// The profiles of the stub listings' authors; the accounts are stubAccounts.user and tarasAccount.
const stubProfiles = [
  {
    accountId: 'c3a1f6d2-4b7e-4f0a-9d21-6e8b5a3c7f14',
    username: 'olena_k',
    displayName: 'Olena',
    description: 'Cinema, galleries and long walks.',
    communicationFormat: 'friends',
    gender: 'female',
    interestIds: [interestFilms, 'b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e12'],
    telegram: 'olena_k',
  },
  {
    accountId: tarasAccount.id,
    username: 'taras.m',
    displayName: 'Taras',
    description: null,
    communicationFormat: 'casual',
    gender: 'male',
    interestIds: ['b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e04'],
    telegram: 'taras_m',
  },
];

// Dates count from the day of the run, as the stubs' did, so the catalog always has upcoming events.
const inDays = (days: number) => addDays(kyivDate(), days);

const stubOrganizations = [
  { accountId: stubAccounts.org.id, name: 'Podil Film Club', verificationStatus: 'verified' },
  { accountId: stubAccounts.orgPending.id, name: 'New Gallery', verificationStatus: 'pending' },
];

const stubVenues = [
  {
    id: filmClubVenue,
    name: 'Natalka Park lawn',
    address: 'Naberezhno-Luhova St, Kyiv',
    latitude: 50.4825,
    longitude: 30.5181,
    source: 'organization',
    organizationId: stubAccounts.org.id,
  },
  {
    id: arsenalVenue,
    name: 'Mystetskyi Arsenal',
    address: '10-12 Lavrska St, Kyiv',
    latitude: 50.4357,
    longitude: 30.5555,
    source: 'import',
    organizationId: null,
  },
  {
    id: newGalleryHall,
    name: 'New Gallery hall',
    address: '5 Velyka Vasylkivska St, Kyiv',
    latitude: 50.4401,
    longitude: 30.5203,
    source: 'organization',
    organizationId: stubAccounts.orgPending.id,
  },
];

const stubEvents = [
  {
    id: filmNight,
    title: 'Open-air film night: Shadows of Forgotten Ancestors',
    description: 'Screening in the park, bring a blanket.',
    categoryId: concerts,
    venueId: filmClubVenue,
    startsAt: `${inDays(13)}T19:00:00+03:00`,
    endsAt: `${inDays(13)}T21:30:00+03:00`,
    source: 'organization',
    status: 'published',
    organizationId: stubAccounts.org.id,
  },
  {
    id: arsenalExhibition,
    title: 'Contemporary art exhibition at the Arsenal',
    description: 'Imported from a partner listing.',
    categoryId: exhibitions,
    venueId: arsenalVenue,
    startsAt: `${inDays(16)}T11:00:00+03:00`,
    endsAt: `${inDays(16)}T23:59:59+03:00`,
    source: 'import',
    status: 'published',
    organizationId: null,
  },
  {
    id: cancelledFilmEvent,
    title: 'Silent film with live piano',
    description: 'Cancelled: the pianist is ill.',
    categoryId: concerts,
    venueId: filmClubVenue,
    startsAt: `${inDays(20)}T18:00:00+03:00`,
    endsAt: `${inDays(20)}T20:00:00+03:00`,
    source: 'organization',
    status: 'cancelled',
    organizationId: stubAccounts.org.id,
  },
];

const stubListings = [
  {
    id: olenasListing,
    authorId: stubAccounts.user.id,
    categoryId: exhibitions,
    eventId: arsenalExhibition,
    title: 'Looking for company for the Arsenal exhibition',
    description: 'Planning to go in the evening, happy to grab a coffee after.',
    date: inDays(16),
  },
  {
    id: tarasListing,
    authorId: tarasAccount.id,
    categoryId: concerts,
    eventId: null,
    title: 'Anyone up for a jazz concert?',
    description: 'No ticket yet, open to suggestions.',
    date: inDays(7),
  },
];

const subjects = Object.fromEntries(Object.entries(stubAccounts).map(([name, { subject }]) => [name, subject])) as {
  [name in keyof typeof stubAccounts]: string;
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
// Stands in for Nominatim's /reverse, so no test calls the real service.
let nominatimServer: Server;
const nominatimRequests: string[] = [];

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

/** A JPEG, left half red and right half blue, with a camera location in its metadata. */
async function testPicture({ width = 400, height = 300, orientation = 1 } = {}): Promise<Buffer> {
  const blue = await sharp({ create: { width: width / 2, height, channels: 3, background: 'blue' } })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: 'red' } })
    .composite([{ input: blue, left: width / 2, top: 0 }])
    .jpeg()
    .withMetadata({ orientation, exif: { IFD0: { Copyright: 'e2e' }, IFD3: { GPSLatitudeRef: 'N' } } })
    .toBuffer();
}

const wholePicture = 'cropLeft=0&cropTop=0&cropWidth=1&cropHeight=1';

/** Sends the picture as the raw body, as the app does. */
async function upload(
  path: string,
  picture: Buffer,
  { token, contentType = 'image/jpeg', crop = wholePicture }: { token?: string; contentType?: string; crop?: string },
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': contentType };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${path}?${crop}`, { method: 'PUT', headers, body: new Uint8Array(picture) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
}

/** GET /images/{id}: the status, headers and the decoded picture's metadata. */
async function getImage(id: string, token: string) {
  const res = await fetch(`${baseUrl}/api/v1/images/${id}`, { headers: { authorization: `Bearer ${token}` } });
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    headers: res.headers,
    bytes,
    metadata: res.ok ? await sharp(bytes).metadata() : undefined,
  };
}

/** The colour of the pixel in the middle of the picture. */
async function centreColour(picture: Uint8Array): Promise<number[]> {
  const { data, info } = await sharp(picture).raw().toBuffer({ resolveWithObject: true });
  const offset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  return [...data.subarray(offset, offset + 3)];
}

/** Signs in with Google and returns the new session's tokens. */
async function newSession(subject: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await call('POST', '/api/v1/auth/google', { body: { idToken: await googleIdToken(subject) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

async function signIn(subject: string): Promise<string> {
  return (await newSession(subject)).accessToken;
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

/** Starts registration with a new Google account and returns its subject and registration token. */
async function newRegistrant(): Promise<{ subject: string; token: string }> {
  const subject = newGoogleSubject();
  const res = await call('POST', '/api/v1/auth/google/register', { body: { idToken: await googleIdToken(subject) } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { subject, token: res.body.accessToken };
}

/** Registers a new Google account and returns its subject and access token. */
async function newAccount(): Promise<{ subject: string; token: string }> {
  const { subject, token } = await newRegistrant();
  const res = await call('POST', '/api/v1/auth/complete-registration', { token, body: { dateOfBirth: '2000-05-17' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { subject, token: res.body.accessToken };
}

/** Registers a new account with a profile and returns its Google subject, tokens, account id and username. */
async function newProfile(): Promise<{
  subject: string;
  token: string;
  refreshToken: string;
  accountId: string;
  username: string;
}> {
  const registrant = await newRegistrant();
  const session = await call('POST', '/api/v1/auth/complete-registration', {
    token: registrant.token,
    body: { dateOfBirth: '2000-05-17' },
  });
  assert.equal(session.status, 200, JSON.stringify(session.body));
  const { accessToken: token, refreshToken } = session.body;
  const username = `u_${randomUUID().slice(0, 8)}`;
  const res = await call('POST', '/api/v1/me/profile', { token, body: { username, displayName: 'Reported' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { subject: registrant.subject, token, refreshToken, accountId: accountIdOf(token), username };
}

/** A new account whose profile has everything matching needs. */
// Born 2000-05-17 (newProfile), so 26 in the autumn of 2026.
async function newCompleteProfile(
  gender: 'female' | 'male' | 'other' = 'female',
): Promise<{ token: string; accountId: string; username: string }> {
  const { token, accountId, username } = await newProfile();
  const genderFields = gender === 'other' ? { gender, genderDescription: 'Небінарна людина' } : { gender };
  for (const [method, path, body] of [
    ['PATCH', '/api/v1/me/profile', { communicationFormat: 'friends', ...genderFields }],
    ['PUT', '/api/v1/me/profile/interests', { interestIds: [interestFilms] }],
    [
      'PUT',
      '/api/v1/me/profile/linked-accounts',
      { linkedAccounts: [{ network: 'telegram', username: 'nearby_e2e' }] },
    ],
  ] as const) {
    const res = await call(method, path, { token, body });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }
  return { token, accountId, username };
}

/** Reports the user and resolves the case with `action`; returns the case id. */
async function reportAndResolve(username: string, accountId: string, action: 'ban' | 'dismiss'): Promise<string> {
  await call('POST', '/api/v1/reports', { token: tokens.user, body: { username, reason: 'other' } });
  const caseId = await openCaseOf(accountId);
  const res = await call('POST', `/api/v1/admin/report-cases/${caseId}/${action}`, { token: tokens.admin });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return caseId ?? '';
}

/** The id of the account's open report case; undefined when it has none. */
async function openCaseOf(accountId: string): Promise<string | undefined> {
  const { rows } = await withDatabase((client) =>
    client.query(`SELECT id FROM report_cases WHERE target_account_id = $1 AND status = 'open'`, [accountId]),
  );
  return rows[0]?.id;
}

/** The id of the listing's open report case; undefined when it has none. */
async function openListingCaseOf(listingId: string): Promise<string | undefined> {
  const { rows } = await withDatabase((client) =>
    client.query(`SELECT id FROM report_cases WHERE target_listing_id = $1 AND status = 'open'`, [listingId]),
  );
  return rows[0]?.id;
}

/** A new user with a profile and one listing, reported once by the stub user; the author, listing id and case id. */
async function newReportedListing(): Promise<{
  author: Awaited<ReturnType<typeof newProfile>>;
  listingId: string;
  caseId: string;
}> {
  const author = await newProfile();
  const listing = await call('POST', '/api/v1/listings', { token: author.token, body: newListing });
  assert.equal(listing.status, 201, JSON.stringify(listing.body));
  const report = await call('POST', '/api/v1/reports', {
    token: tokens.user,
    body: { listingId: listing.body.id, reason: 'other' },
  });
  assert.equal(report.status, 204, JSON.stringify(report.body));
  return { author, listingId: listing.body.id, caseId: (await openListingCaseOf(listing.body.id)) ?? '' };
}

/** Active accounts with the stubs' ids and a Google sign-in, the date of birth encrypted with the run's key, and the
 * profiles of the stub listings' authors. */
async function addStubAccounts(cipher: PersonalDataCipher): Promise<void> {
  await withDatabase(async (client) => {
    for (const { id, role, subject, dateOfBirth } of Object.values(stubAccounts)) {
      await client.query(`INSERT INTO accounts (id, role, status, date_of_birth) VALUES ($1, $2, 'active', $3)`, [
        id,
        role,
        cipher.encrypt(dateOfBirth),
      ]);
      await client.query(`INSERT INTO auth_methods (account_id, type, secret) VALUES ($1, 'google', $2)`, [
        id,
        subject,
      ]);
    }
    await client.query(`INSERT INTO accounts (id, role, status, date_of_birth) VALUES ($1, 'user', 'active', $2)`, [
      tarasAccount.id,
      cipher.encrypt(tarasAccount.dateOfBirth),
    ]);
    for (const {
      accountId,
      username,
      displayName,
      description,
      communicationFormat,
      gender,
      interestIds,
      telegram,
    } of stubProfiles) {
      await client.query(
        `INSERT INTO profiles (account_id, username, display_name, description, communication_format, gender)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [accountId, username, displayName, description, communicationFormat, gender],
      );
      await client.query(`INSERT INTO linked_accounts (profile_id, app, username) VALUES ($1, 'telegram', $2)`, [
        accountId,
        cipher.encrypt(telegram),
      ]);
      for (const interestId of interestIds) {
        await client.query(`INSERT INTO profile_interests (profile_id, interest_id) VALUES ($1, $2)`, [
          accountId,
          interestId,
        ]);
      }
    }
  });
}

/** The stubs' organizations, venues, events and listings with their ids, after the accounts they belong to. */
async function addStubCatalog(): Promise<void> {
  await withDatabase(async (client) => {
    for (const { accountId, name, verificationStatus } of stubOrganizations) {
      await client.query(`INSERT INTO organizations (account_id, name, verification_status) VALUES ($1, $2, $3)`, [
        accountId,
        name,
        verificationStatus,
      ]);
    }
    for (const { id, name, address, latitude, longitude, source, organizationId } of stubVenues) {
      await client.query(
        `INSERT INTO venues (id, name, address, latitude, longitude, source, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, name, address, latitude, longitude, source, organizationId],
      );
    }
    for (const event of stubEvents) {
      await client.query(
        `INSERT INTO events (id, title, description, category_id, venue_id, starts_at, ends_at, source, status, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          event.id,
          event.title,
          event.description,
          event.categoryId,
          event.venueId,
          event.startsAt,
          event.endsAt,
          event.source,
          event.status,
          event.organizationId,
        ],
      );
    }
    for (const { id, authorId, categoryId, eventId, title, description, date } of stubListings) {
      await client.query(
        `INSERT INTO listings (id, author_id, category_id, event_id, title, description, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, authorId, categoryId, eventId, title, description, date],
      );
    }
  });
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
  return runDatabaseUrl('MAIN_DATABASE_URL');
}

/** The role's connection string from `variable`, pointed at the run's database. */
function runDatabaseUrl(variable: 'MAIN_DATABASE_URL' | 'IMPORT_DATABASE_URL'): string {
  const roleUrl = process.env[variable];
  if (!roleUrl) {
    throw new Error(`${variable} is not set: see .env.example`);
  }
  const url = new URL(roleUrl);
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

/** A good night a day ago and a failed one now, as deploy/backup-db.sh writes them. */
async function insertBackupNights(): Promise<{ finished_at: Date }[]> {
  const { rows } = await withDatabase((client) =>
    client.query(`INSERT INTO backup_runs (finished_at, succeeded, attempts, duration_seconds, size_bytes, reason)
      VALUES (now() - interval '1 day', true, 1, 12, 4404019, NULL), (now(), false, 3, 0, NULL, 'unreachable')
      RETURNING finished_at`),
  );
  return rows;
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
  const keyFile = (name: string, key = randomBytes(32)) => {
    const file = path.join(keysDir, name);
    writeFileSync(file, key.toString('base64url'));
    return file;
  };
  const dataEncryptionKey = randomBytes(32);
  const contactHmacKey = randomBytes(32);
  const jwtKeysFile = path.join(keysDir, 'jwt-keys.json');
  const jwk = { kty: 'oct', alg: 'HS256', kid: jwtKey.kid, k: jwtKey.secret.toString('base64url') };
  writeFileSync(jwtKeysFile, JSON.stringify({ keys: [jwk] }));
  const google = await generateKeyPair('RS256', { extractable: true });
  googleKey = google.privateKey;
  const jwks = JSON.stringify({ keys: [{ ...(await exportJWK(google.publicKey)), kid: googleKid, alg: 'RS256' }] });
  jwksServer = createHttpServer((_req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end(jwks));
  const jwksPort = await freePort();
  await new Promise<void>((resolve) => jwksServer.listen(jwksPort, resolve));
  nominatimServer = createHttpServer((req, res) => {
    const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
    nominatimRequests.push(`${query.get('lat')},${query.get('lon')}`);
    const json = (status: number, body: object) =>
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    if (query.get('lat') === '50.4357') {
      json(200, {
        name: 'Мистецький Арсенал',
        address: { road: 'вулиця Лаврська', house_number: '10-12', city_district: 'Печерський район' },
      });
    } else if (query.get('lat') === '50.401') {
      json(503, {});
    } else {
      json(200, { error: 'Unable to geocode' });
    }
  });
  const nominatimPort = await freePort();
  await new Promise<void>((resolve) => nominatimServer.listen(nominatimPort, resolve));
  apiEnv = {
    ...process.env,
    // Production mode so the run does not rewrite the committed OpenAPI spec.
    NODE_ENV: 'production',
    DATABASE_URL: databaseUrl,
    MAIN_DATABASE_URL: mainDatabaseUrl(),
    CODE_HMAC_KEY_FILE: keyFile('code-hmac.key'),
    CONTACT_HMAC_KEY_FILE: keyFile('contact-hmac.key', contactHmacKey),
    DATA_ENCRYPTION_KEY_FILE: keyFile('data-encryption.key', dataEncryptionKey),
    JWT_KEYS_FILE: jwtKeysFile,
    GOOGLE_CLIENT_IDS: googleClientId,
    GOOGLE_JWKS_URL: `http://localhost:${jwksPort}/certs`,
    ALLOW_TEST_ADAPTERS: 'true',
    NOMINATIM_BASE_URL: `http://localhost:${nominatimPort}`,
  };
  runOrThrow('node_modules/.bin/prisma', ['migrate', 'deploy'], apiEnv);
  await addStubAccounts(new PersonalDataCipher(dataEncryptionKey, contactHmacKey));
  await addStubCatalog();
  // Every test calls from the same IP, so the per-IP auth limit is lifted here and tested on its own API.
  // stdout is kept for the test that checks what the log contains.
  ({ child: server, url: baseUrl } = await startApi({ AUTH_RATE_LIMIT_PER_MINUTE: '10000' }, (chunk) => {
    serverOutput += chunk;
  }));
  tokens.guest = (await call('POST', '/api/v1/auth/guest')).body.accessToken;
  tokens.user = await signIn(subjects.user);
  tokens.org = await signIn(subjects.org);
  tokens.orgPending = await signIn(subjects.orgPending);
  tokens.admin = await signIn(subjects.admin);
});

// The database stays until the next run, to look into after a failure.
after(() => {
  server?.kill();
  jwksServer?.close();
  nominatimServer?.close();
  rmSync(keysDir, { recursive: true, force: true });
});

describe('GET /health', () => {
  test('reports healthy, with the database up, without a token', async () => {
    const res = await call('GET', '/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'healthy', checks: { database: 'up' } });
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
  test('returns the tokens of a new session for a registered Google account', async () => {
    const res = await call('POST', '/api/v1/auth/google', { body: { idToken: await googleIdToken(subjects.user) } });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.tokenType, 'Bearer');
    assert.equal(res.body.expiresIn, 3600);
    assert.match(res.body.refreshToken, /^[0-9a-f-]{36}\.[\w-]{43}$/);
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
  });

  test('refuses a Google account that is not registered with 401', async () => {
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

describe('POST /api/v1/auth/google/register', () => {
  async function register(subject: string) {
    return call('POST', '/api/v1/auth/google/register', { body: { idToken: await googleIdToken(subject) } });
  }

  test('registers a new Google account, which signs in with Google once registration is complete', async () => {
    const subject = newGoogleSubject();
    const registered = await register(subject);
    assert.equal(registered.status, 200, JSON.stringify(registered.body));

    const completed = await call('POST', '/api/v1/auth/complete-registration', {
      token: registered.body.accessToken,
      body: { dateOfBirth: '2000-05-17' },
    });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));

    const signedIn = await call('POST', '/api/v1/auth/google', { body: { idToken: await googleIdToken(subject) } });
    assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
  });

  test('returns a registration token that only finishing registration accepts', async () => {
    const { token } = await newRegistrant();

    assertRejected(await call('GET', '/api/v1/listings', { token }), 401, 'UNAUTHENTICATED');
  });

  test('continues a registration that was not completed', async () => {
    const subject = newGoogleSubject();
    await register(subject);

    const again = await register(subject);

    assert.equal(again.status, 200, JSON.stringify(again.body));
    const completed = await call('POST', '/api/v1/auth/complete-registration', {
      token: again.body.accessToken,
      body: { dateOfBirth: '2000-05-17' },
    });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
  });

  test('does not sign in before registration is complete', async () => {
    const subject = newGoogleSubject();
    await register(subject);

    const res = await call('POST', '/api/v1/auth/google', { body: { idToken: await googleIdToken(subject) } });

    assertRejected(res, 401, 'INVALID_CREDENTIALS');
  });

  test('refuses a Google account that is already registered with 409', async () => {
    const subject = newGoogleSubject();
    const registered = await register(subject);
    await call('POST', '/api/v1/auth/complete-registration', {
      token: registered.body.accessToken,
      body: { dateOfBirth: '2000-05-17' },
    });

    assertRejected(await register(subject), 409, 'GOOGLE_ACCOUNT_TAKEN');
  });

  // SAFE-001: the pending account is removed, so the Google account can register again.
  test('lets an underage Google account start again after it is refused', async () => {
    const subject = newGoogleSubject();
    const registered = await register(subject);
    const underage = await call('POST', '/api/v1/auth/complete-registration', {
      token: registered.body.accessToken,
      body: { dateOfBirth: '2015-01-01' },
    });
    assertRejected(underage, 422, 'UNDERAGE');

    assert.equal((await register(subject)).status, 200);
  });

  test('refuses an ID token issued to another app with 422', async () => {
    const idToken = await googleIdToken(newGoogleSubject(), { audience: 'another-app' });

    const res = await call('POST', '/api/v1/auth/google/register', { body: { idToken } });

    assertRejected(res, 422, 'INVALID_GOOGLE_TOKEN');
  });

  test('rejects a body without an ID token with 400', async () => {
    assertInvalid(await call('POST', '/api/v1/auth/google/register', { body: {} }), 'body', 'idToken');
  });
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
    const attempt = { idToken: 'not-a-google-id-token' };
    await post('/api/v1/auth/google', attempt);
    await post('/api/v1/auth/google', attempt);

    const res = await post('/api/v1/auth/google', attempt);

    assert.equal(res.status, 429);
    assert.equal((await res.json()).error.code, 'RATE_LIMITED');
    assert.ok(Number(res.headers.get('retry-after')) > 0, String(res.headers.get('retry-after')));
  });

  // The limit counts a request before its body is checked, so an empty body is enough.
  const limitedEndpoints = [['POST', '/api/v1/auth/google/register']];

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

// SEC-007 behind Caddy on staging: the per-IP limit counts the client from X-Forwarded-For only
// when TRUST_PROXY names the proxy. Here the test itself plays the proxy on loopback.
describe('Per-IP limit behind a reverse proxy', () => {
  let trusting: { child: ChildProcess; url: string };

  before(async () => {
    trusting = await startApi({ AUTH_RATE_LIMIT_PER_MINUTE: '2', TRUST_PROXY: 'loopback' });
  });

  after(() => {
    trusting?.child.kill();
  });

  function signInFrom(api: { url: string }, clientIp: string): Promise<number> {
    return fetch(api.url + '/api/v1/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
      body: JSON.stringify({ idToken: 'not-a-google-id-token' }),
    }).then((res) => res.status);
  }

  test('gives each client behind a trusted proxy a limit of its own', async () => {
    const statuses = [];
    for (const clientIp of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) {
      statuses.push(await signInFrom(trusting, clientIp));
    }

    assert.ok(!statuses.includes(429), String(statuses));
  });

  test('still limits one client behind a trusted proxy', async () => {
    await signInFrom(trusting, '203.0.113.9');
    await signInFrom(trusting, '203.0.113.9');

    assert.equal(await signInFrom(trusting, '203.0.113.9'), 429);
  });

  test('refuses to start with TRUST_PROXY=true', async () => {
    await assert.rejects(startApi({ TRUST_PROXY: 'true' }), /exited with code/);
  });
});

// SEC-005: sessions renew without signing in again, and end at once on sign-out.
describe('POST /api/v1/auth/refresh', () => {
  test('returns new tokens that work', async () => {
    const session = await newSession(subjects.user);

    const res = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.expiresIn, 3600);
    assert.notEqual(res.body.refreshToken, session.refreshToken);
    assert.equal((await call('GET', '/api/v1/listings', { token: res.body.accessToken })).status, 200);
  });

  // REL-08: the answer of a refresh was lost, so the app still has the token that refresh replaced.
  test('accepts the replaced refresh token within 60 s as a retry, and the lost one stops working', async () => {
    const session = await newSession(subjects.user);
    const lost = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });

    const retry = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });

    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal((await call('GET', '/api/v1/listings', { token: retry.body.accessToken })).status, 200);
    const next = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: retry.body.refreshToken } });
    assert.equal(next.status, 200, JSON.stringify(next.body));
    const lostUsed = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: lost.body.refreshToken } });
    assertRejected(lostUsed, 401, 'INVALID_REFRESH_TOKEN');
  });

  test('ends the session when a replaced refresh token comes back more than 60 s later', async () => {
    const session = await newSession(subjects.user);
    const renewed = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } });
    const [sessionId] = session.refreshToken.split('.');
    await withDatabase((client) =>
      client.query(`UPDATE refresh_tokens SET rotated_at = now() - interval '61 seconds' WHERE id = $1`, [sessionId]),
    );

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
    const session = await newSession(subjects.user);
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
    const session = await newSession(subjects.user);

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
    assert.deepEqual([res.body.startTimeKnown, res.body.endTimeKnown], [true, true]);
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/events/not-a-uuid', { token: tokens.guest }), 'params', 'id');
  });
});

describe('Event organizer', () => {
  test('shows the verified organization that published the event', async () => {
    const res = await call('GET', `/api/v1/events/${filmNight}`, { token: tokens.guest });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.organizer, { id: stubAccounts.org.id, name: 'Podil Film Club', logo: null });
  });

  test('shows no organizer for an imported event', async () => {
    const res = await call('GET', `/api/v1/events/${arsenalExhibition}`, { token: tokens.guest });
    assert.equal(res.status, 200);
    assert.equal(res.body.organizer, null);
  });
});

describe('Public organization pages', () => {
  test('returns a verified organization to a guest, without private fields', async () => {
    const res = await call('GET', `/api/v1/organizations/${stubAccounts.org.id}`, { token: tokens.guest });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['description', 'id', 'instagram', 'logo', 'name', 'officialLink']);
    assert.equal(res.body.id, stubAccounts.org.id);
    assert.equal(res.body.name, 'Podil Film Club');
  });

  test('lists its published events that have not ended, soonest first', async () => {
    const res = await call('GET', `/api/v1/organizations/${stubAccounts.org.id}/events`, { token: tokens.guest });
    assert.equal(res.status, 200);
    const ids = res.body.items.map((event: { id: string }) => event.id);
    assert.ok(ids.includes(filmNight));
    assert.ok(!ids.includes(cancelledFilmEvent));
    assert.ok(
      res.body.items.every((event: { organizer: { id: string } }) => event.organizer.id === stubAccounts.org.id),
    );
  });

  test('answers 404 for an organization that is not verified, and for an account without one', async () => {
    for (const id of [stubAccounts.orgPending.id, stubAccounts.user.id]) {
      assertRejected(await call('GET', `/api/v1/organizations/${id}`, { token: tokens.guest }), 404, 'NOT_FOUND');
      assertRejected(
        await call('GET', `/api/v1/organizations/${id}/events`, { token: tokens.guest }),
        404,
        'NOT_FOUND',
      );
    }
  });

  test('rejects a call without a token with 401', async () => {
    assertRejected(await call('GET', `/api/v1/organizations/${stubAccounts.org.id}`), 401, 'UNAUTHENTICATED');
  });
});

describe('POST /api/v1/events', () => {
  test('publishes an event for a verified organization', async () => {
    const res = await call('POST', '/api/v1/events', { token: tokens.org, body: newEvent });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, newEvent.title);
    assert.deepEqual([res.body.startTimeKnown, res.body.endTimeKnown], [true, true]);
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
    // The database keeps the instant, not the offset it was sent with.
    assert.equal(Date.parse(res.body.startsAt), Date.parse(replacement.startsAt));
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

// The price tag of the event card (#423): whole hryvnias, read back from the catalog and the event page.
describe('Event price', () => {
  const day = inDays(3);
  const pricedEvent = {
    ...newEvent,
    title: 'Film quiz night with tickets',
    startsAt: `${day}T19:00:00+02:00`,
    endsAt: `${day}T21:00:00+02:00`,
    priceMin: 300,
    priceMax: 700,
  };

  async function publish(body: object): Promise<string> {
    const res = await call('POST', '/api/v1/events', { token: tokens.org, body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.id;
  }

  async function priceInCatalog(id: string): Promise<unknown> {
    const query = `venueId=${filmClubVenue}&from=${day}&to=${day}&limit=20`;
    const res = await call('GET', `/api/v1/events?${query}`, { token: tokens.guest });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const event = res.body.items.find((item: { id: string }) => item.id === id);
    assert.ok(event, `${id} is not in the catalog`);
    return [event.priceMin, event.priceMax];
  }

  async function priceOnPage(id: string): Promise<unknown> {
    const res = await call('GET', `/api/v1/events/${id}`, { token: tokens.guest });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return [res.body.priceMin, res.body.priceMax];
  }

  test('publishes an event with a range and returns it from the catalog and the event page', async () => {
    const id = await publish(pricedEvent);

    assert.deepEqual(await priceInCatalog(id), [300, 700]);
    assert.deepEqual(await priceOnPage(id), [300, 700]);
  });

  test('returns an event published without a price with both fields null', async () => {
    const { priceMin: _min, priceMax: _max, ...body } = pricedEvent;

    const id = await publish(body);

    assert.deepEqual(await priceInCatalog(id), [null, null]);
    assert.deepEqual(await priceOnPage(id), [null, null]);
  });

  test('replaces the price on PUT, and makes it unknown when an edit leaves it out', async () => {
    const id = await publish(pricedEvent);

    const free = await call('PUT', `/api/v1/events/${id}`, {
      token: tokens.org,
      body: { ...pricedEvent, priceMin: 0, priceMax: null },
    });
    assert.equal(free.status, 200, JSON.stringify(free.body));
    assert.deepEqual([free.body.priceMin, free.body.priceMax], [0, null]);
    assert.deepEqual(await priceInCatalog(id), [0, null]);

    const { priceMin: _min, priceMax: _max, ...withoutPrice } = pricedEvent;
    const unknown = await call('PUT', `/api/v1/events/${id}`, { token: tokens.org, body: withoutPrice });
    assert.equal(unknown.status, 200, JSON.stringify(unknown.body));
    assert.deepEqual(await priceOnPage(id), [null, null]);
  });

  const invalid = [
    { price: { priceMin: -1, priceMax: null }, field: 'priceMin', title: 'a negative price' },
    { price: { priceMin: 449.5, priceMax: null }, field: 'priceMin', title: 'a price that is not whole hryvnias' },
    { price: { priceMin: null, priceMax: 700 }, field: 'priceMax', title: 'a highest price without a lowest one' },
    { price: { priceMin: 700, priceMax: 300 }, field: 'priceMax', title: 'a highest price below the lowest' },
  ];
  for (const { price, field, title } of invalid) {
    test(`rejects ${title} with 400 on POST and PUT`, async () => {
      const body = { ...pricedEvent, ...price };

      assertInvalid(await call('POST', '/api/v1/events', { token: tokens.org, body }), 'body', field);
      assertInvalid(await call('PUT', `/api/v1/events/${filmNight}`, { token: tokens.org, body }), 'body', field);
    });
  }
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

describe('GET /api/v1/me/events', () => {
  test('lists the organization’s events that have not ended, cancelled ones too, soonest first', async () => {
    const upcoming = await call('POST', '/api/v1/events', {
      token: tokens.org,
      body: { ...newEvent, startsAt: `${inDays(3)}T19:00:00+03:00`, endsAt: `${inDays(3)}T21:00:00+03:00` },
    });
    const ended = await call('POST', '/api/v1/events', {
      token: tokens.org,
      body: { ...newEvent, startsAt: `${inDays(-1)}T19:00:00+03:00`, endsAt: `${inDays(-1)}T21:00:00+03:00` },
    });
    assert.equal(upcoming.status, 201, JSON.stringify(upcoming.body));
    assert.equal(ended.status, 201, JSON.stringify(ended.body));

    const res = await call('GET', '/api/v1/me/events', { token: tokens.org });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const ids = res.body.items.map((event: { id: string }) => event.id);
    assert.ok(ids.includes(upcoming.body.id));
    assert.ok(ids.includes(cancelledFilmEvent));
    assert.ok(!ids.includes(ended.body.id), 'an ended event is not listed');
    assert.ok(!ids.includes(arsenalExhibition), 'an imported event is not listed');
    const starts = res.body.items.map((event: { startsAt: string }) => Date.parse(event.startsAt));
    assert.deepEqual(
      starts,
      [...starts].sort((a, b) => a - b),
    );
  });

  test('is empty for an account that is not an organization', async () => {
    const res = await call('GET', '/api/v1/me/events', { token: tokens.user });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
  });

  test('rejects a guest token with 401', async () => {
    assertRejected(await call('GET', '/api/v1/me/events', { token: tokens.guest }), 401, 'UNAUTHENTICATED');
  });
});

describe('Organization venues', () => {
  const newVenue = {
    name: 'Kyiv Film Studio yard',
    address: '44 Peremohy Ave, Kyiv',
    location: { lat: 50.4555, lng: 30.4407 },
  };

  test('lists only the organization’s own venues', async () => {
    const res = await call('GET', '/api/v1/me/venues', { token: tokens.org });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const ids = res.body.items.map((venue: { id: string }) => venue.id);
    assert.ok(ids.includes(filmClubVenue));
    assert.ok(!ids.includes(arsenalVenue), 'an imported venue is not listed');
    assert.ok(!ids.includes(newGalleryHall), 'another organization’s venue is not listed');
  });

  test('is empty for an account that is not an organization', async () => {
    const res = await call('GET', '/api/v1/me/venues', { token: tokens.user });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
  });

  test('adds a venue that the organization can then publish an event at', async () => {
    const created = await call('POST', '/api/v1/me/venues', { token: tokens.org, body: newVenue });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual({ ...created.body, id: undefined }, { ...newVenue, id: undefined });

    assert.equal(created.headers.get('location'), `/api/v1/me/venues/${created.body.id}`);
    const fetched = await call('GET', `/api/v1/me/venues/${created.body.id}`, { token: tokens.org });
    assert.deepEqual(fetched.body, created.body);

    const listed = await call('GET', '/api/v1/me/venues', { token: tokens.org });
    assert.ok(listed.body.items.some((venue: { id: string }) => venue.id === created.body.id));
    const others = await call('GET', '/api/v1/me/venues', { token: tokens.orgPending });
    assert.ok(!others.body.items.some((venue: { id: string }) => venue.id === created.body.id));

    const event = await call('POST', '/api/v1/events', {
      token: tokens.org,
      body: { ...newEvent, venueId: created.body.id },
    });
    assert.equal(event.status, 201, JSON.stringify(event.body));
    assert.equal(event.body.venue.id, created.body.id);
  });

  test('answers 404 for another organization’s venue and an imported one', async () => {
    for (const id of [newGalleryHall, arsenalVenue]) {
      assertRejected(await call('GET', `/api/v1/me/venues/${id}`, { token: tokens.org }), 404, 'NOT_FOUND');
    }
  });

  test('rejects an organization that is not verified, and a regular user, with 422', async () => {
    for (const token of [tokens.orgPending, tokens.user]) {
      assertRejected(
        await call('POST', '/api/v1/me/venues', { token, body: newVenue }),
        422,
        'ORGANIZATION_NOT_VERIFIED',
      );
    }
  });

  test('rejects a point outside Kyiv with 422', async () => {
    const body = { ...newVenue, location: { lat: 49.8419, lng: 24.0315 } };
    assertRejected(await call('POST', '/api/v1/me/venues', { token: tokens.org, body }), 422, 'VENUE_OUTSIDE_CITY');
  });

  test('rejects a body without a name or location with 400, one details entry each', async () => {
    const res = await call('POST', '/api/v1/me/venues', { token: tokens.org, body: { address: newVenue.address } });
    assertInvalid(res, 'body', 'name');
    assertInvalid(res, 'body', 'location');
    assert.equal(res.body.error.details.length, 2, JSON.stringify(res.body.error.details));
  });

  test('rejects a guest token with 401', async () => {
    assertRejected(
      await call('POST', '/api/v1/me/venues', { token: tokens.guest, body: newVenue }),
      401,
      'UNAUTHENTICATED',
    );
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

describe('Listing place', () => {
  const place = {
    name: 'Мистецький Арсенал',
    address: 'вулиця Лаврська, 10-12',
    location: { lat: 50.4357, lng: 30.5555 },
  };

  test('posts a listing with a place and returns it', async () => {
    const res = await call('POST', '/api/v1/listings', { token: tokens.user, body: { ...newListing, place } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.place, place);
    const read = await call('GET', `/api/v1/listings/${res.body.id}`, { token: tokens.user });
    assert.deepEqual(read.body.place, place);
  });

  test('posts a listing without a place with place null', async () => {
    const res = await call('POST', '/api/v1/listings', { token: tokens.user, body: newListing });
    assert.equal(res.status, 201);
    assert.equal(res.body.place, null);
  });

  test('rejects a place outside Kyiv with 422', async () => {
    const res = await call('POST', '/api/v1/listings', {
      token: tokens.user,
      body: { ...newListing, place: { ...place, location: { lat: 49.8441, lng: 24.0262 } } },
    });
    assertRejected(res, 422, 'PLACE_OUTSIDE_CITY');
  });

  test('rejects a place without its location with 400', async () => {
    const res = await call('POST', '/api/v1/listings', {
      token: tokens.user,
      body: { ...newListing, place: { name: place.name, address: place.address } },
    });
    assertInvalid(res, 'body', 'place.location');
  });
});

describe('GET /api/v1/places/reverse', () => {
  test('names the point, and answers it again from memory', async () => {
    const before = nominatimRequests.length;
    const first = await call('GET', '/api/v1/places/reverse?lat=50.4357&lng=30.5555', { token: tokens.user });
    const again = await call('GET', '/api/v1/places/reverse?lat=50.435701&lng=30.555501', { token: tokens.user });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.deepEqual(first.body, {
      name: 'Мистецький Арсенал',
      address: 'вулиця Лаврська, 10-12, Печерський район',
    });
    assert.deepEqual(again.body, first.body);
    assert.equal(nominatimRequests.length - before, 1);
  });

  test('answers 404 when nothing is there', async () => {
    const res = await call('GET', '/api/v1/places/reverse?lat=50.45&lng=30.52', { token: tokens.user });
    assertRejected(res, 404, 'NOT_FOUND');
  });

  test('answers 503 when Nominatim fails', async () => {
    const res = await call('GET', '/api/v1/places/reverse?lat=50.401&lng=30.52', { token: tokens.user });
    assertRejected(res, 503, 'PLACE_LOOKUP_UNAVAILABLE');
  });

  test('rejects a point outside Kyiv with 422', async () => {
    const res = await call('GET', '/api/v1/places/reverse?lat=49.8441&lng=24.0262', { token: tokens.user });
    assertRejected(res, 422, 'PLACE_OUTSIDE_CITY');
  });

  test('rejects a guest token with 401', async () => {
    const res = await call('GET', '/api/v1/places/reverse?lat=50.4357&lng=30.5555', { token: tokens.guest });
    assertRejected(res, 401, 'UNAUTHENTICATED');
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

describe('PUT and DELETE /api/v1/listings/{id}/photo', () => {
  test('adds a 2:1 photo to the caller’s own listing; readers see it, and removing it deletes the picture', async () => {
    const created = await call('POST', '/api/v1/listings', { token: tokens.user, body: newListing });
    const res = await upload(`/api/v1/listings/${created.body.id}/photo`, await testPicture(), { token: tokens.user });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body.photo).sort(), ['height', 'id', 'width']);
    assert.equal(res.body.photo.width, 2 * res.body.photo.height);

    const read = await call('GET', `/api/v1/listings/${created.body.id}`, { token: tokens.org });
    assert.deepEqual(read.body.photo, res.body.photo);
    const image = await getImage(res.body.photo.id, tokens.org);
    assert.equal(image.status, 200);
    assert.equal(image.metadata?.width, 400);
    assert.equal(image.metadata?.height, 200);

    const removed = await call('DELETE', `/api/v1/listings/${created.body.id}/photo`, { token: tokens.user });
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.equal(removed.body.photo, null);
    assert.equal((await getImage(res.body.photo.id, tokens.org)).status, 404);
  });

  test('shows the author’s profile photo to readers', async () => {
    const { token } = await newProfile();
    const photo = await upload('/api/v1/me/profile/photo', await testPicture(), { token });
    const created = await call('POST', '/api/v1/listings', { token, body: newListing });

    const read = await call('GET', `/api/v1/listings/${created.body.id}`, { token: tokens.org });
    assert.deepEqual(read.body.author.photo, photo.body.photo);
    assert.equal((await getImage(read.body.author.photo.id, tokens.org)).status, 200);
  });

  test('answers 404 for someone else’s listing', async () => {
    const created = await call('POST', '/api/v1/listings', { token: tokens.user, body: newListing });
    const res = await upload(`/api/v1/listings/${created.body.id}/photo`, await testPicture(), { token: tokens.org });
    assertRejected(res, 404, 'NOT_FOUND');
    assertRejected(
      await call('DELETE', `/api/v1/listings/${created.body.id}/photo`, { token: tokens.org }),
      404,
      'NOT_FOUND',
    );
  });
});

describe('Listing requests', () => {
  /** A listing by a new author with a complete profile, so both sides have contacts to reveal. */
  async function newAuthorListing(): Promise<{ token: string; listingId: string }> {
    const { token } = await newCompleteProfile();
    const res = await call('POST', '/api/v1/listings', { token, body: newListing });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return { token, listingId: res.body.id };
  }

  function request(token: string, listingId: string): Promise<Response> {
    return call('POST', `/api/v1/listings/${listingId}/requests`, { token });
  }

  async function requested(): Promise<{ author: string; requester: string; listingId: string; requestId: string }> {
    const { token: author, listingId } = await newAuthorListing();
    const { token: requester } = await newCompleteProfile();
    const res = await request(requester, listingId);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return { author, requester, listingId, requestId: res.body.id };
  }

  const acknowledge = (token: string) =>
    call('POST', '/api/v1/me/profile/safety-notice', { token, body: { dontShowAgain: false } });

  async function inboxOf(token: string): Promise<{ type: string; payload: Record<string, unknown> }[]> {
    const res = await call('GET', '/api/v1/me/notifications', { token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.items;
  }

  test('creates a pending request that the listing then shows as the caller’s own', async () => {
    const { token: author, listingId } = await newAuthorListing();
    const { token: requester, username } = await newCompleteProfile();

    const res = await request(requester, listingId);

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.headers.get('location'), `/api/v1/listing-requests/${res.body.id}`);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.role, 'requester');
    assert.equal(res.body.requester.username, username);
    const listing = await call('GET', `/api/v1/listings/${listingId}`, { token: requester });
    assert.deepEqual(listing.body.myRequest, { id: res.body.id, status: 'pending' });
    const inFeed = (await call('GET', '/api/v1/listings', { token: requester })).body.items.find(
      (item: { id: string }) => item.id === listingId,
    );
    assert.deepEqual(inFeed?.myRequest, { id: res.body.id, status: 'pending' });
    assert.equal((await call('GET', `/api/v1/listings/${listingId}`, { token: author })).body.myRequest, null);
  });

  test('shows the author the request with the requester’s public profile and no contacts', async () => {
    const { author, requestId, listingId } = await requested();

    const res = await call('GET', '/api/v1/me/listing-requests', { token: author });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    const [item] = res.body.items;
    assert.equal(item.id, requestId);
    assert.equal(item.role, 'author');
    assert.equal(item.listing.id, listingId);
    assert.equal(item.requester.age, 26);
    assert.equal(item.requester.interests[0].id, interestFilms);
    assert.equal('phone' in item.requester, false);
    assert.equal('linkedAccounts' in item.requester, false);
    const notification = (await inboxOf(author)).find(({ type }) => type === 'listing_request');
    assert.deepEqual(notification?.payload, { listingRequestId: requestId, listingId, displayName: 'Reported' });
  });

  test('rejects a request on the caller’s own listing with 422', async () => {
    const { token, listingId } = await newAuthorListing();

    assertRejected(await request(token, listingId), 422, 'CANNOT_REQUEST_OWN_LISTING');
  });

  test('rejects a second request with 409', async () => {
    const { requester, listingId } = await requested();

    assertRejected(await request(requester, listingId), 409, 'ALREADY_REQUESTED');
  });

  test('rejects a request from an incomplete profile with 422', async () => {
    const { listingId } = await newAuthorListing();
    const { token } = await newProfile();

    assertRejected(await request(token, listingId), 422, 'PROFILE_INCOMPLETE');
  });

  test('answers 404 for a removed listing, and hides its pending requests', async () => {
    const { author, requester, listingId, requestId } = await requested();
    assert.equal((await call('DELETE', `/api/v1/listings/${listingId}`, { token: author })).status, 204);

    const { token: late } = await newCompleteProfile();
    assertRejected(await request(late, listingId), 404, 'NOT_FOUND');
    assertRejected(await call('GET', `/api/v1/listing-requests/${requestId}`, { token: requester }), 404, 'NOT_FOUND');
    assertRejected(
      await call('POST', `/api/v1/listing-requests/${requestId}/accept`, { token: author }),
      404,
      'NOT_FOUND',
    );
    const mine = await call('GET', '/api/v1/me/listing-requests', { token: author });
    assert.deepEqual(mine.body.items, []);
  });

  test('accepted: the contacts wait for each side’s safety notice, then both see the other’s', async () => {
    const { author, requester, requestId } = await requested();
    const contacts = (token: string) => call('GET', `/api/v1/listing-requests/${requestId}/contacts`, { token });
    assertRejected(await contacts(author), 404, 'NOT_FOUND');

    const accepted = await call('POST', `/api/v1/listing-requests/${requestId}/accept`, { token: author });

    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.status, 'accepted');
    assert.ok(accepted.body.decidedAt);
    const notification = (await inboxOf(requester)).find(({ type }) => type === 'listing_request_accepted');
    assert.equal(notification?.payload.listingRequestId, requestId);
    for (const token of [author, requester]) {
      assertRejected(await contacts(token), 422, 'SAFETY_NOTICE_REQUIRED');
      assert.equal((await acknowledge(token)).status, 200);
      const res = await contacts(token);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.linkedAccounts[0].username, 'nearby_e2e');
    }
    assertRejected(
      await call('POST', `/api/v1/listing-requests/${requestId}/decline`, { token: author }),
      409,
      'CONFLICT',
    );
  });

  test('declined: the request stays declined and opens no contacts', async () => {
    const { author, requester, listingId, requestId } = await requested();

    const declined = await call('POST', `/api/v1/listing-requests/${requestId}/decline`, { token: author });

    assert.equal(declined.status, 200, JSON.stringify(declined.body));
    assert.equal(declined.body.status, 'declined');
    assert.deepEqual(await inboxOf(requester), []);
    assert.equal((await acknowledge(requester)).status, 200);
    assertRejected(
      await call('GET', `/api/v1/listing-requests/${requestId}/contacts`, { token: requester }),
      404,
      'NOT_FOUND',
    );
    const listing = await call('GET', `/api/v1/listings/${listingId}`, { token: requester });
    assert.deepEqual(listing.body.myRequest, { id: requestId, status: 'declined' });
  });

  test('lets only the author answer', async () => {
    const { requester, requestId } = await requested();

    assertRejected(
      await call('POST', `/api/v1/listing-requests/${requestId}/accept`, { token: requester }),
      404,
      'NOT_FOUND',
    );
  });

  test('answers 404 to a third user, even once accepted', async () => {
    const { author, requestId } = await requested();
    await call('POST', `/api/v1/listing-requests/${requestId}/accept`, { token: author });
    const { token: stranger } = await newCompleteProfile();
    await acknowledge(stranger);

    for (const path of ['', '/contacts']) {
      const res = await call('GET', `/api/v1/listing-requests/${requestId}${path}`, { token: stranger });
      assertRejected(res, 404, 'NOT_FOUND');
    }
    assertRejected(
      await call('POST', `/api/v1/listing-requests/${requestId}/decline`, { token: stranger }),
      404,
      'NOT_FOUND',
    );
  });

  test('rejects a guest with 401', async () => {
    const { listingId } = await newAuthorListing();

    assertRejected(await request(tokens.guest, listingId), 401, 'UNAUTHENTICATED');
  });
});

describe('Applications', () => {
  const answers = { desiredCompany: 'company', afterEventPlans: ['coffee', 'walk'] };

  async function newEventAt(startsAt: string, endsAt: string): Promise<string> {
    const res = await call('POST', '/api/v1/events', { token: tokens.org, body: { ...newEvent, startsAt, endsAt } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.id;
  }

  function apply(token: string, eventId: string, body: object = answers): Promise<Response> {
    return call('POST', `/api/v1/events/${eventId}/applications`, { token, body });
  }

  const at19 = (day: string) => fromKyivWallClock(`${day}T19:00:00Z`).toISOString();
  const at21 = (day: string) => fromKyivWallClock(`${day}T21:00:00Z`).toISOString();
  // From the day after tomorrow to three days later, at 19:00 Kyiv time.
  const multiDay = () => ({ startsAt: at19(inDays(2)), endsAt: at19(inDays(5)) });

  // Events of their own: other tests edit the stub events. New ones for every test, so the applications of one test
  // never meet those of another in a pool and get matched.
  let soonEvent = '';
  let laterEvent = '';

  beforeEach(async () => {
    soonEvent = await newEventAt(at19(inDays(13)), at21(inDays(13)));
    laterEvent = await newEventAt(at19(inDays(16)), at21(inDays(16)));
  });

  test('puts the caller in the pool of a single-day event and says when the next round runs', async () => {
    const { token } = await newCompleteProfile();
    const start = Date.parse(at19(inDays(13)));

    const res = await apply(token, soonEvent);

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.headers.get('location'), `/api/v1/applications/${res.body.id}`);
    assert.equal(res.body.eventId, soonEvent);
    assert.deepEqual(res.body.sessions, [
      { startsAt: new Date(start).toISOString(), cutoffAt: new Date(start - 60 * 60 * 1000).toISOString() },
    ]);
    assert.equal(res.body.status, 'in_pool');
    assert.equal(res.body.desiredCompany, 'company');
    assert.deepEqual(res.body.afterEventPlans, ['walk', 'coffee']);
    assert.equal(res.body.cutoffAt, new Date(start - 60 * 60 * 1000).toISOString());
    // 13 days ahead, so the first round, a week before the event, is still to come.
    assert.equal(res.body.nextRoundAt, new Date(start - 7 * 24 * 60 * 60 * 1000).toISOString());
  });

  test('takes an empty list of plans as only the event', async () => {
    const { token } = await newCompleteProfile();

    const res = await apply(token, soonEvent, { desiredCompany: 'dating', afterEventPlans: [] });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(res.body.afterEventPlans, []);
  });

  test('puts the caller in the pool of a multi-day event for the picked days', async () => {
    const { token } = await newCompleteProfile();
    const { startsAt, endsAt } = multiDay();
    const eventId = await newEventAt(startsAt, endsAt);

    const res = await apply(token, eventId, { ...answers, dates: [inDays(4), inDays(3)] });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual(
      res.body.sessions.map(({ startsAt }: { startsAt: string }) => startsAt),
      [at19(inDays(3)), at19(inDays(4))],
    );
    assert.equal(res.body.cutoffAt, res.body.sessions[1].cutoffAt);
  });

  test('rejects a second application to another day of the same event with 409', async () => {
    const { token } = await newCompleteProfile();
    const { startsAt, endsAt } = multiDay();
    const eventId = await newEventAt(startsAt, endsAt);
    assert.equal((await apply(token, eventId, { ...answers, dates: [inDays(3)] })).status, 201);

    assertRejected(await apply(token, eventId, { ...answers, dates: [inDays(4)] }), 409, 'ALREADY_APPLIED');
  });

  test('rejects a multi-day event without a day, or with a day it does not run on, with 422', async () => {
    const { token } = await newCompleteProfile();
    const { startsAt, endsAt } = multiDay();
    const eventId = await newEventAt(startsAt, endsAt);

    assertRejected(await apply(token, eventId), 422, 'INVALID_SESSION_DAY');
    assertRejected(await apply(token, eventId, { ...answers, dates: [inDays(6)] }), 422, 'INVALID_SESSION_DAY');
    assertRejected(
      await apply(token, eventId, { ...answers, dates: [inDays(3), inDays(6)] }),
      422,
      'INVALID_SESSION_DAY',
    );
    assert.deepEqual((await call('GET', '/api/v1/me/applications', { token })).body, []);
  });

  test('rejects a profile that matching cannot use yet with 422', async () => {
    const { token } = await newProfile();
    assertRejected(await apply(token, soonEvent), 422, 'PROFILE_INCOMPLETE');
  });

  // Profiles made before genders were asked: everything else is set, and the app sends the user to add one.
  test('rejects a profile without a gender with 422', async () => {
    const { token } = await newCompleteProfile();
    await withDatabase((client) =>
      client.query('UPDATE profiles SET gender = NULL, gender_description = NULL WHERE account_id = $1', [
        accountIdOf(token),
      ]),
    );

    assertRejected(await apply(token, soonEvent), 422, 'PROFILE_INCOMPLETE');
  });

  test('rejects an account without a profile with 422', async () => {
    const { token } = await newAccount();
    assertRejected(await apply(token, soonEvent), 422, 'PROFILE_INCOMPLETE');
  });

  test('rejects a cancelled event with 422', async () => {
    const { token } = await newCompleteProfile();
    assertRejected(await apply(token, cancelledFilmEvent), 422, 'EVENT_CANCELLED');
  });

  test('takes applications to a long event that has started until 2 hours before its end', async () => {
    const { token } = await newCompleteProfile();
    const hour = 60 * 60 * 1000;
    const eventId = await newEventAt(
      new Date(Date.now() - hour).toISOString(),
      new Date(Date.now() + 3 * hour).toISOString(),
    );

    assert.equal((await apply(token, eventId)).status, 201);
  });

  test('rejects a long event that ends within 2 hours with 422', async () => {
    const { token } = await newCompleteProfile();
    const hour = 60 * 60 * 1000;
    const eventId = await newEventAt(
      new Date(Date.now() - 3 * hour).toISOString(),
      new Date(Date.now() + hour).toISOString(),
    );

    assertRejected(await apply(token, eventId), 422, 'APPLICATIONS_CLOSED');
  });

  test('rejects a short event within an hour of its start with 422', async () => {
    const { token } = await newCompleteProfile();
    const minute = 60 * 1000;
    const eventId = await newEventAt(
      new Date(Date.now() + 30 * minute).toISOString(),
      new Date(Date.now() + 150 * minute).toISOString(),
    );

    assertRejected(await apply(token, eventId), 422, 'APPLICATIONS_CLOSED');
  });

  test('rejects a short event that has started with 422', async () => {
    const { token } = await newCompleteProfile();
    const hour = 60 * 60 * 1000;
    const eventId = await newEventAt(
      new Date(Date.now() - hour).toISOString(),
      new Date(Date.now() + hour).toISOString(),
    );

    assertRejected(await apply(token, eventId), 422, 'APPLICATIONS_CLOSED');
  });

  test('rejects an event that does not exist with 404', async () => {
    const { token } = await newCompleteProfile();
    assertRejected(await apply(token, randomUUID()), 404, 'NOT_FOUND');
  });

  test('rejects a second application for the same session with 409', async () => {
    const { token } = await newCompleteProfile();
    assert.equal((await apply(token, soonEvent)).status, 201);

    assertRejected(await apply(token, soonEvent), 409, 'ALREADY_APPLIED');
  });

  test('accepts only one of two applications sent at once', async () => {
    const { token } = await newCompleteProfile();

    const statuses = (await Promise.all([apply(token, laterEvent), apply(token, laterEvent)]))
      .map((res) => res.status)
      .sort();

    assert.deepEqual(statuses, [201, 409]);
  });

  test('rejects a plan or a day given twice, an unknown plan, and missing answers, with 400', async () => {
    const { token } = await newCompleteProfile();

    assertInvalid(await apply(token, soonEvent, { ...answers, dates: [inDays(13), inDays(13)] }), 'body', 'dates');

    assertInvalid(
      await apply(token, soonEvent, { ...answers, afterEventPlans: ['walk', 'walk'] }),
      'body',
      'afterEventPlans',
    );
    assertInvalid(
      await apply(token, soonEvent, { ...answers, afterEventPlans: ['cinema'] }),
      'body',
      'afterEventPlans.0',
    );
    assertInvalid(await apply(token, soonEvent, { afterEventPlans: [] }), 'body', 'desiredCompany');
  });

  test('rejects a guest token with 401', async () => {
    assertRejected(await apply(tokens.guest, soonEvent), 401, 'UNAUTHENTICATED');
  });

  test('lists the caller’s active applications, soonest session first', async () => {
    const { token } = await newCompleteProfile();
    const later = await apply(token, laterEvent);
    const sooner = await apply(token, soonEvent);

    const res = await call('GET', '/api/v1/me/applications', { token });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [sooner.body, later.body]);
  });

  test('withdraws an application, leaves it out of the list and lets the caller apply again', async () => {
    const { token } = await newCompleteProfile();
    const applied = await apply(token, soonEvent);

    const res = await call('POST', `/api/v1/applications/${applied.body.id}/withdraw`, { token });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'withdrawn');
    assert.equal(res.body.nextRoundAt, null);
    assert.deepEqual((await call('GET', '/api/v1/me/applications', { token })).body, []);
    assert.equal((await apply(token, soonEvent)).status, 201);
  });

  test('changes nothing when withdrawing again', async () => {
    const { token } = await newCompleteProfile();
    const applied = await apply(token, soonEvent);
    const withdraw = () => call('POST', `/api/v1/applications/${applied.body.id}/withdraw`, { token });
    const first = await withdraw();

    const again = await withdraw();

    assert.equal(again.status, 200);
    assert.deepEqual(again.body, first.body);
  });

  test('gets one of the caller’s applications, and not someone else’s', async () => {
    const owner = await newCompleteProfile();
    const other = await newCompleteProfile();
    const applied = await apply(owner.token, soonEvent);
    const path = `/api/v1/applications/${applied.body.id}`;

    const res = await call('GET', path, { token: owner.token });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, applied.body);
    assertRejected(await call('GET', path, { token: other.token }), 404, 'NOT_FOUND');
  });

  test('rejects withdrawing someone else’s application with 404', async () => {
    const owner = await newCompleteProfile();
    const other = await newCompleteProfile();
    const applied = await apply(owner.token, soonEvent);

    assertRejected(
      await call('POST', `/api/v1/applications/${applied.body.id}/withdraw`, { token: other.token }),
      404,
      'NOT_FOUND',
    );
  });

  // FR-017, matching.md rule 1: the same interests, company and plans score 1.
  test('proposes a match at once to two users who suit each other exceptionally well', async () => {
    const waiting = await newCompleteProfile();
    const newcomer = await newCompleteProfile();
    const first = await apply(waiting.token, soonEvent);

    const res = await apply(newcomer.token, soonEvent);

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.status, 'paired');
    assert.equal(res.body.nextRoundAt, null);
    const waited = await call('GET', `/api/v1/applications/${first.body.id}`, { token: waiting.token });
    assert.equal(waited.body.status, 'paired');
    const { rows } = await withDatabase((client) =>
      client.query(`SELECT source, score FROM matches WHERE application_a_id = $1 AND application_b_id = $2`, [
        res.body.id,
        first.body.id,
      ]),
    );
    assert.deepEqual(rows, [{ source: 'instant', score: '1.000' }]);
  });

  test('stores whom the caller wants to go with and returns it', async () => {
    const { token } = await newCompleteProfile();

    const res = await apply(token, soonEvent, { ...answers, preferredGender: 'male', ageMin: 20, ageMax: 30 });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.deepEqual([res.body.preferredGender, res.body.ageMin, res.body.ageMax], ['male', 20, 30]);
    const read = await call('GET', `/api/v1/applications/${res.body.id}`, { token });
    assert.deepEqual([read.body.preferredGender, read.body.ageMin, read.body.ageMax], ['male', 20, 30]);
  });

  test('takes left-out preferences as anyone of any age', async () => {
    const { token } = await newCompleteProfile();

    const res = await apply(token, soonEvent);

    assert.deepEqual([res.body.preferredGender, res.body.ageMin, res.body.ageMax], ['any', 18, null]);
  });

  test('rejects an age range whose oldest age is below the youngest with 400', async () => {
    const { token } = await newCompleteProfile();

    assertInvalid(await apply(token, soonEvent, { ...answers, ageMin: 30, ageMax: 25 }), 'body', 'ageMax');
  });

  // matching.md, policy: a pair that would score 1 is not matched when one does not want the other's gender.
  test('does not match users who do not fit each other’s gender preference', async () => {
    const waiting = await newCompleteProfile('female');
    const newcomer = await newCompleteProfile('other');
    await apply(waiting.token, soonEvent, { ...answers, preferredGender: 'female' });

    const res = await apply(newcomer.token, soonEvent);

    assert.equal(res.body.status, 'in_pool');
  });

  test('does not match users outside each other’s age range', async () => {
    const waiting = await newCompleteProfile();
    const newcomer = await newCompleteProfile();
    await apply(waiting.token, soonEvent, { ...answers, ageMin: 30 });

    const res = await apply(newcomer.token, soonEvent);

    assert.equal(res.body.status, 'in_pool');
  });

  test('leaves the caller in the pool when nobody suits them well enough', async () => {
    const waiting = await newCompleteProfile();
    const newcomer = await newCompleteProfile();
    await apply(waiting.token, soonEvent, { desiredCompany: 'friends', afterEventPlans: [] });

    const res = await apply(newcomer.token, soonEvent);

    assert.equal(res.body.status, 'in_pool');
  });

  // FUNC-002: both rank the waiting user first, and only one of them gets them.
  test('never proposes one waiting user to two applications sent at once', async () => {
    const waiting = await newCompleteProfile();
    const first = await newCompleteProfile();
    const second = await newCompleteProfile();
    const waited = await apply(waiting.token, soonEvent);

    const results = await Promise.all([apply(first.token, soonEvent), apply(second.token, soonEvent)]);

    assert.deepEqual(
      results.map((res) => res.status),
      [201, 201],
    );
    const { rows } = await withDatabase((client) =>
      client.query(
        `SELECT application_a_id, application_b_id FROM matches
          WHERE application_a_id = ANY($1) OR application_b_id = ANY($1)`,
        [[waited.body.id, ...results.map((res) => res.body.id)]],
      ),
    );
    // Of the three, one pair is proposed and one user keeps waiting, whoever the pair is.
    const matched = rows.flatMap((row: { application_a_id: string; application_b_id: string }) => [
      row.application_a_id,
      row.application_b_id,
    ]);
    assert.equal(rows.length, 1);
    assert.equal(new Set(matched).size, 2);
  });

  // FR-020
  test('never proposes two users one of whom reported the other', async () => {
    const waiting = await newCompleteProfile();
    const reporter = await newCompleteProfile();
    await apply(waiting.token, soonEvent);
    const report = await call('POST', '/api/v1/reports', {
      token: reporter.token,
      body: { username: waiting.username, reason: 'other' },
    });
    assert.equal(report.status, 204);

    const res = await apply(reporter.token, soonEvent);

    assert.equal(res.body.status, 'in_pool');
  });

  // FR-020
  test('never proposes a banned user', async () => {
    const waiting = await newCompleteProfile();
    const newcomer = await newCompleteProfile();
    await apply(waiting.token, soonEvent);
    await reportAndResolve(waiting.username, waiting.accountId, 'ban');

    const res = await apply(newcomer.token, soonEvent);

    assert.equal(res.body.status, 'in_pool');
  });

  // matching.md, rule 2: a round pairs whoever can be paired, however low the score.
  test('plans the rounds of a new session and pairs its pool when a round runs', async () => {
    const first = await newCompleteProfile();
    const second = await newCompleteProfile();
    // The same interest, but another kind of company and other plans: 0.7, too little for an instant match.
    const waiting = await apply(first.token, soonEvent, { desiredCompany: 'friends', afterEventPlans: [] });
    const newcomer = await apply(second.token, soonEvent);
    assert.equal(newcomer.body.status, 'in_pool');
    const start = Date.parse(at19(inDays(13)));

    const rounds = await withDatabase(async (client) => {
      const { rows } = await client.query<{ id: string; start_after: Date }>(
        `SELECT job.id, job.start_after FROM pgboss.job job
           JOIN application_sessions days ON days.session_id::text = job.data->>'sessionId'
          WHERE job.name = 'matching.round' AND days.application_id = $1
          ORDER BY job.start_after`,
        [waiting.body.id],
      );
      return rows;
    });
    assert.deepEqual(
      rounds.map(({ start_after }) => start_after.toISOString()),
      [7 * 24, 3 * 24, 24, 6].map((hours) => new Date(start - hours * 60 * 60 * 1000).toISOString()),
    );

    await withDatabase((client) =>
      client.query('UPDATE pgboss.job SET start_after = now() WHERE id = $1', [rounds[0]?.id]),
    );
    const deadline = Date.now() + 20_000;
    let status = 'in_pool';
    while (status === 'in_pool' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      status = (await call('GET', `/api/v1/applications/${waiting.body.id}`, { token: first.token })).body.status;
    }

    assert.equal(status, 'paired');
    const { rows } = await withDatabase((client) =>
      client.query(
        `SELECT source, score FROM matches
          WHERE $1 IN (application_a_id, application_b_id) AND $2 IN (application_a_id, application_b_id)`,
        [waiting.body.id, newcomer.body.id],
      ),
    );
    assert.deepEqual(rows, [{ source: 'round', score: '0.700' }]);
  });

  /** Two users proposed to each other at once: the same answers score 1. */
  async function aProposal() {
    const waiting = await newCompleteProfile();
    const newcomer = await newCompleteProfile();
    const waited = await apply(waiting.token, soonEvent);
    const applied = await apply(newcomer.token, soonEvent);
    assert.equal(applied.body.status, 'paired', JSON.stringify(applied.body));
    const mine = await call('GET', '/api/v1/me/matches', { token: waiting.token });
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    return { waiting, newcomer, waited: waited.body, applied: applied.body, match: mine.body[0] };
  }

  const answer = (token: string, matchId: string, verb: 'accept' | 'decline') =>
    call('POST', `/api/v1/matches/${matchId}/${verb}`, { token });

  async function acknowledgeSafetyNotice(token: string): Promise<void> {
    const res = await call('POST', '/api/v1/me/profile/safety-notice', { token, body: { dontShowAgain: false } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }

  // FR-019, SEC-001, UC-001 steps 8–11
  test('shows a proposal without contacts, and the contacts once both users accept', async () => {
    const { waiting, newcomer, waited, match } = await aProposal();

    assert.equal(match.applicationId, waited.id);
    assert.equal(match.status, 'proposed');
    assert.equal(match.partner.username, newcomer.username);
    assert.equal(match.partner.desiredCompany, 'company');
    assert.equal(match.days.length, 1);
    assert.equal('linkedAccounts' in match.partner, false);
    assertRejected(
      await call('GET', `/api/v1/matches/${match.id}/contacts`, { token: waiting.token }),
      404,
      'NOT_FOUND',
    );

    const accepted = await answer(waiting.token, match.id, 'accept');
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.status, 'accepted');
    // The other does not see that the first one accepted.
    const seenByOther = await call('GET', `/api/v1/matches/${match.id}`, { token: newcomer.token });
    assert.equal(seenByOther.body.status, 'proposed');
    assertRejected(
      await call('GET', `/api/v1/matches/${match.id}/contacts`, { token: waiting.token }),
      404,
      'NOT_FOUND',
    );

    const mutual = await answer(newcomer.token, match.id, 'accept');
    assert.equal(mutual.body.status, 'mutual');
    await acknowledgeSafetyNotice(waiting.token);
    const contacts = await call('GET', `/api/v1/matches/${match.id}/contacts`, { token: waiting.token });
    assert.equal(contacts.status, 200, JSON.stringify(contacts.body));
    assert.deepEqual(contacts.body, {
      phone: null,
      linkedAccounts: [{ network: 'telegram', username: 'nearby_e2e', url: 'https://t.me/nearby_e2e' }],
    });
    assert.equal((await answer(newcomer.token, match.id, 'accept')).body.status, 'mutual');
    assertRejected(await answer(waiting.token, match.id, 'decline'), 409, 'CONFLICT');
    assertRejected(
      await call('POST', `/api/v1/applications/${waited.id}/withdraw`, { token: waiting.token }),
      409,
      'CONFLICT',
    );
  });

  // SAFE-002, FR-032, TC-39
  test('holds the contacts of a mutual match back until the caller acknowledges the safety notice', async () => {
    const { waiting, newcomer, match } = await aProposal();
    await answer(waiting.token, match.id, 'accept');
    assert.equal((await answer(newcomer.token, match.id, 'accept')).body.status, 'mutual');
    const contactsOf = (token: string) => call('GET', `/api/v1/matches/${match.id}/contacts`, { token });

    assertRejected(await contactsOf(waiting.token), 422, 'SAFETY_NOTICE_REQUIRED');
    assertRejected(await contactsOf(newcomer.token), 422, 'SAFETY_NOTICE_REQUIRED');

    await acknowledgeSafetyNotice(waiting.token);
    assert.equal((await contactsOf(waiting.token)).status, 200);
    // Each user acknowledges for themselves.
    assertRejected(await contactsOf(newcomer.token), 422, 'SAFETY_NOTICE_REQUIRED');
  });

  // UC-001 A3, matching.md rule 5, FR-020
  test('returns both users to the pool on decline and never proposes them to each other again', async () => {
    const { waiting, newcomer, waited, applied, match } = await aProposal();

    const declined = await answer(newcomer.token, match.id, 'decline');

    assert.equal(declined.status, 200, JSON.stringify(declined.body));
    assert.equal(declined.body.status, 'declined');
    for (const [token, id] of [
      [waiting.token, waited.id],
      [newcomer.token, applied.id],
    ]) {
      assert.equal((await call('GET', `/api/v1/applications/${id}`, { token })).body.status, 'in_pool');
    }
    assert.deepEqual((await call('GET', '/api/v1/me/matches', { token: waiting.token })).body, []);
    assertRejected(await answer(waiting.token, match.id, 'accept'), 409, 'CONFLICT');
    // Applying again, the same answers would score 1, but the pair stays apart.
    await call('POST', `/api/v1/applications/${applied.id}/withdraw`, { token: newcomer.token });
    assert.equal((await apply(newcomer.token, soonEvent)).body.status, 'in_pool');
  });

  // UC-001 A5
  test('cancels a pending proposal when one of the two withdraws, and returns the other to the pool', async () => {
    const { waiting, newcomer, waited, applied, match } = await aProposal();

    const withdrawn = await call('POST', `/api/v1/applications/${applied.id}/withdraw`, { token: newcomer.token });

    assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
    assert.equal(withdrawn.body.status, 'withdrawn');
    assert.equal(
      (await call('GET', `/api/v1/applications/${waited.id}`, { token: waiting.token })).body.status,
      'in_pool',
    );
    assert.equal((await call('GET', `/api/v1/matches/${match.id}`, { token: waiting.token })).body.status, 'cancelled');
  });

  /** A long event that started an hour ago and ends in 3 hours: past its last round, its cutoff an hour away. */
  async function anEventUnderWay(): Promise<string> {
    const hour = 60 * 60 * 1000;
    return newEventAt(new Date(Date.now() - hour).toISOString(), new Date(Date.now() + 3 * hour).toISOString());
  }

  /** The application's status once it is no longer `from`, or `from` after 20 seconds. */
  async function statusAfter(token: string, id: string, from: string): Promise<string> {
    const deadline = Date.now() + 20_000;
    let status = from;
    while (status === from && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      status = (await call('GET', `/api/v1/applications/${id}`, { token })).body.status;
    }
    return status;
  }

  // matching.md, rule 3
  test('proposes the best partner at once to an application after the last round, however low the score', async () => {
    const eventId = await anEventUnderWay();
    const first = await newCompleteProfile();
    const second = await newCompleteProfile();
    const waiting = await apply(first.token, eventId, { desiredCompany: 'friends', afterEventPlans: [] });
    assert.equal(waiting.body.status, 'in_pool');
    assert.equal(waiting.body.nextRoundAt, null);

    const latecomer = await apply(second.token, eventId);

    assert.equal(latecomer.status, 201, JSON.stringify(latecomer.body));
    assert.equal(latecomer.body.status, 'paired');
    const { rows } = await withDatabase((client) =>
      client.query(`SELECT source, score, valid_until FROM matches WHERE application_a_id = $1`, [latecomer.body.id]),
    );
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].source, rows[0].score], ['open', '0.700']);
    assert.equal(rows[0].valid_until.toISOString(), latecomer.body.cutoffAt);
  });

  test('leaves an application after the last round waiting when nobody can be paired with it', async () => {
    const eventId = await anEventUnderWay();
    const first = await newCompleteProfile();
    const second = await newCompleteProfile();
    await apply(first.token, eventId, { ...answers, desiredCompany: 'dating' });

    const latecomer = await apply(second.token, eventId);

    assert.equal(latecomer.body.status, 'in_pool');
    assert.equal(latecomer.body.nextRoundAt, null);
  });

  // FUNC-002, matching.md rule 7
  test('never proposes one waiting user to two applications sent at once in open mode', async () => {
    const eventId = await anEventUnderWay();
    const waiting = await newCompleteProfile();
    const first = await newCompleteProfile();
    const second = await newCompleteProfile();
    const waited = await apply(waiting.token, eventId);

    const results = await Promise.all([apply(first.token, eventId), apply(second.token, eventId)]);

    const ids = [waited.body.id, ...results.map((res) => res.body.id)];
    const { rows } = await withDatabase((client) =>
      client.query(
        `SELECT application_a_id, application_b_id FROM matches
          WHERE application_a_id = ANY($1) OR application_b_id = ANY($1)`,
        [ids],
      ),
    );
    // The first of the two takes the waiting user; the second then finds the first already paired.
    assert.equal(rows.length, 1);
    assert.equal(rows[0].application_b_id, waited.body.id);
  });

  // matching.md, rules 3 and 5
  test('proposes a declined user again in open mode', async () => {
    const eventId = await anEventUnderWay();
    const [first, second, third] = [await newCompleteProfile(), await newCompleteProfile(), await newCompleteProfile()];
    await apply(first.token, eventId);
    assert.equal((await apply(second.token, eventId)).body.status, 'paired');
    const [match] = (await call('GET', '/api/v1/me/matches', { token: first.token })).body;
    const lonely = await apply(third.token, eventId, { desiredCompany: 'friends', afterEventPlans: [] });
    assert.equal(lonely.body.status, 'in_pool');

    await answer(second.token, match.id, 'decline');

    // The two are kept apart, and one of them now pairs with the third, who has waited alone.
    const status = (await call('GET', `/api/v1/applications/${lonely.body.id}`, { token: third.token })).body.status;
    assert.equal(status, 'paired');
  });

  // FR-018
  test('ends an application still waiting at the cutoff with no match, until the user dismisses it', async () => {
    const eventId = await anEventUnderWay();
    const { token } = await newCompleteProfile();
    const applied = await apply(token, eventId);
    assert.equal(applied.body.status, 'in_pool');
    const other = await newCompleteProfile();
    const inPool = await apply(other.token, soonEvent);

    await withDatabase(async (client) => {
      // The event now ends within 2 hours, so its cutoff has passed.
      await client.query(`UPDATE events SET ends_at = now() + interval '1 hour' WHERE id = $1`, [eventId]);
      await client.query(
        `UPDATE pgboss.job SET start_after = now()
          WHERE name = 'matching.cutoff' AND data->>'sessionId' IN
            (SELECT session_id::text FROM application_sessions WHERE application_id = $1)`,
        [applied.body.id],
      );
    });

    assert.equal(await statusAfter(token, applied.body.id, 'in_pool'), 'no_match');
    const inbox = await call('GET', '/api/v1/me/notifications', { token });
    assert.deepEqual(
      inbox.body.items.map(({ type, payload }: { type: string; payload: object }) => [type, payload]),
      [['no_match_found', { applicationId: applied.body.id, eventId }]],
    );
    const listed = await call('GET', '/api/v1/me/applications', { token });
    assert.deepEqual(
      listed.body.map(({ id, status }: { id: string; status: string }) => [id, status]),
      [[applied.body.id, 'no_match']],
    );

    const dismissed = await call('POST', `/api/v1/applications/${applied.body.id}/dismiss`, { token });
    assert.equal(dismissed.status, 200, JSON.stringify(dismissed.body));
    assert.deepEqual((await call('GET', '/api/v1/me/applications', { token })).body, []);
    assert.equal((await call('POST', `/api/v1/applications/${applied.body.id}/dismiss`, { token })).status, 200);
    assertRejected(
      await call('POST', `/api/v1/applications/${inPool.body.id}/dismiss`, { token: other.token }),
      409,
      'CONFLICT',
    );
    assertRejected(
      await call('POST', `/api/v1/applications/${applied.body.id}/dismiss`, { token: other.token }),
      404,
      'NOT_FOUND',
    );
  });

  // SEC-001
  test('reports a match to anyone but its two users as missing', async () => {
    const { match } = await aProposal();

    assertRejected(await call('GET', `/api/v1/matches/${match.id}`, { token: tokens.user }), 404, 'NOT_FOUND');
    assertRejected(await answer(tokens.user, match.id, 'accept'), 404, 'NOT_FOUND');
    assertRejected(await answer(tokens.user, match.id, 'decline'), 404, 'NOT_FOUND');
  });

  // HLD I3, matching.md rule 10: the API consumes event.changed, so these wait for its job to run.
  describe('after the event changes (event.changed)', () => {
    const JOB_WAIT_MS = 30_000;

    async function eventually<T>(what: string, check: () => Promise<T | undefined>): Promise<T> {
      const until = Date.now() + JOB_WAIT_MS;
      for (;;) {
        const value = await check();
        if (value !== undefined) {
          return value;
        }
        assert.ok(Date.now() < until, `${what} did not happen`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Without push_status: notifications.deliver may change it while a test reads the inbox.
    const inboxOf = (accountId: string) =>
      withDatabase(async (client) => {
        const { rows } = await client.query<{ type: string; payload: Record<string, unknown> }>(
          'SELECT type, payload FROM notifications WHERE account_id = $1 ORDER BY created_at',
          [accountId],
        );
        return rows;
      });

    const sessionsOf = (eventId: string) =>
      withDatabase(async (client) => {
        const { rows } = await client.query<{ status: string; starts_at: Date }>(
          'SELECT status, starts_at FROM event_sessions WHERE event_id = $1 ORDER BY starts_at',
          [eventId],
        );
        return rows.map(({ status, starts_at }) => ({ status, startsAt: starts_at.toISOString() }));
      });

    const finishedJobsOf = (eventId: string) =>
      withDatabase(async (client) => {
        const { rows } = await client.query<{ finished: number }>(
          `SELECT count(*)::int AS finished FROM pgboss.job
           WHERE name = 'event.changed' AND data->>'eventId' = $1 AND state::text = 'completed'`,
          [eventId],
        );
        return rows[0]?.finished ?? 0;
      });

    const proposalsOf = (applicationId: string) =>
      withDatabase(async (client) => {
        const { rows } = await client.query<{ status: string; cancel_reason: string | null }>(
          `SELECT status::text AS status, cancel_reason::text AS cancel_reason FROM matches
           WHERE application_a_id = $1 OR application_b_id = $1`,
          [applicationId],
        );
        return rows;
      });

    /** Enqueues the job as a producer would, outside the API. */
    /** The organization moves the event to start at 18:00 on `day`; gives the new start. */
    async function startAt18(eventId: string, day: string): Promise<string> {
      const at18 = fromKyivWallClock(`${day}T18:00:00Z`).toISOString();
      const edited = await call('PUT', `/api/v1/events/${eventId}`, {
        token: tokens.org,
        body: { ...newEvent, startsAt: at18, endsAt: at21(day) },
      });
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      return at18;
    }

    async function enqueueEventChanged(eventId: string, change: string): Promise<void> {
      const queue = new PgBossJobQueue(mainDatabaseUrl(), { sendOnly: true });
      queue.onApplicationBootstrap();
      try {
        await queue.enqueue('event.changed', { eventId, change });
      } finally {
        await queue.onModuleDestroy();
      }
    }

    const applicationOf = async (token: string, id: string) =>
      (await call('GET', `/api/v1/applications/${id}`, { token })).body;

    test('a cancelled event cancels its application and session and tells the applicant once, also when the job runs twice', async () => {
      const { token, accountId } = await newCompleteProfile();
      const start = at19(inDays(9));
      const eventId = await newEventAt(start, at21(inDays(9)));
      const applied = await apply(token, eventId);
      assert.equal(applied.status, 201, JSON.stringify(applied.body));

      const cancelled = await call('POST', `/api/v1/events/${eventId}/cancel`, { token: tokens.org });
      assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

      const application = await eventually('Cancelling the application', async () => {
        const body = await applicationOf(token, applied.body.id);
        return body.status === 'cancelled' ? body : undefined;
      });
      assert.deepEqual(application.sessions, applied.body.sessions, 'it still says which day it was for');
      assert.deepEqual(
        (await call('GET', '/api/v1/me/applications', { token })).body,
        [],
        'no longer among the active',
      );
      assert.deepEqual(await sessionsOf(eventId), [{ status: 'cancelled', startsAt: start }]);
      const inbox = [
        {
          type: 'event_changed',
          payload: {
            eventId,
            applicationId: applied.body.id,
            change: 'cancelled',
            sessions: [{ from: start, to: null }],
            applicationCancelled: true,
          },
        },
      ];
      assert.deepEqual(await inboxOf(accountId), inbox);
      assertRejected(await apply(token, eventId), 422, 'EVENT_CANCELLED');

      await enqueueEventChanged(eventId, 'cancelled');
      await eventually('The second job', async () => ((await finishedJobsOf(eventId)) >= 2 ? true : undefined));
      assert.deepEqual(await inboxOf(accountId), inbox, 'the second job tells nobody again');
      assert.equal((await applicationOf(token, applied.body.id)).status, 'cancelled');
    });

    test('an event moved to another time moves its session, keeps the application and tells the applicant', async () => {
      const { token, accountId } = await newCompleteProfile();
      const day = inDays(10);
      const eventId = await newEventAt(at19(day), at21(day));
      const applied = await apply(token, eventId);
      assert.equal(applied.status, 201, JSON.stringify(applied.body));
      const at20 = fromKyivWallClock(`${day}T20:00:00Z`).toISOString();
      const at22 = fromKyivWallClock(`${day}T22:00:00Z`).toISOString();

      const edited = await call('PUT', `/api/v1/events/${eventId}`, {
        token: tokens.org,
        body: { ...newEvent, startsAt: at20, endsAt: at22 },
      });
      assert.equal(edited.status, 200, JSON.stringify(edited.body));

      const [notification] = await eventually('Telling the applicant', async () => {
        const inbox = await inboxOf(accountId);
        return inbox.length > 0 ? inbox : undefined;
      });
      assert.deepEqual(notification?.payload, {
        eventId,
        applicationId: applied.body.id,
        change: 'rescheduled',
        sessions: [{ from: at19(day), to: at20 }],
        applicationCancelled: false,
      });
      assert.deepEqual(await sessionsOf(eventId), [
        { status: 'cancelled', startsAt: at19(day) },
        { status: 'scheduled', startsAt: at20 },
      ]);
      const application = await applicationOf(token, applied.body.id);
      assert.equal(application.status, 'in_pool');
      assert.equal(application.sessions[0].startsAt, at20);
    });

    test('a shared day moved earlier cancels the pending proposal for the change, and both wait in the pool again', async () => {
      const day = inDays(12);
      const eventId = await newEventAt(at19(day), at21(day));
      const first = await newCompleteProfile();
      const second = await newCompleteProfile();
      const waiting = await apply(first.token, eventId);
      const paired = await apply(second.token, eventId);
      assert.equal(paired.body.status, 'paired', 'the two are proposed to each other at once');
      const at18 = await startAt18(eventId, day);

      const proposals = await eventually('Cancelling the proposal', async () => {
        const rows = await proposalsOf(waiting.body.id);
        return rows[0]?.status === 'cancelled' ? rows : undefined;
      });
      assert.deepEqual(proposals, [{ status: 'cancelled', cancel_reason: 'event_changed' }]);
      for (const [token, id] of [
        [first.token, waiting.body.id],
        [second.token, paired.body.id],
      ] as const) {
        const application = await applicationOf(token, id);
        assert.equal(application.status, 'in_pool');
        assert.deepEqual(
          application.sessions.map(({ startsAt }: { startsAt: string }) => startsAt),
          [at18],
        );
      }
    });

    /** Two new users who apply to the event, are proposed to each other at once and both accept. */
    async function mutualMatchAt(eventId: string) {
      const first = await newCompleteProfile();
      const second = await newCompleteProfile();
      const applications = [await apply(first.token, eventId), await apply(second.token, eventId)];
      assert.equal(applications[1]?.body.status, 'paired', 'the two are proposed to each other at once');
      const [match] = (await call('GET', '/api/v1/me/matches', { token: first.token })).body;
      for (const { token } of [first, second]) {
        assert.equal((await call('POST', `/api/v1/matches/${match.id}/accept`, { token })).status, 200);
      }
      assert.equal((await call('GET', `/api/v1/matches/${match.id}`, { token: first.token })).body.status, 'mutual');
      return { first, second, matchId: match.id as string, applicationId: applications[0]!.body.id as string };
    }

    test('a mutual match on a cancelled event is cancelled, both are told once, also when the job runs twice', async () => {
      const day = inDays(16);
      const eventId = await newEventAt(at19(day), at21(day));
      const { first, second, matchId, applicationId } = await mutualMatchAt(eventId);

      assert.equal((await call('POST', `/api/v1/events/${eventId}/cancel`, { token: tokens.org })).status, 200);

      const proposals = await eventually('Cancelling the match', async () => {
        const rows = await proposalsOf(applicationId);
        return rows[0]?.status === 'cancelled' ? rows : undefined;
      });
      assert.deepEqual(proposals, [{ status: 'cancelled', cancel_reason: 'event_cancelled' }]);
      assert.equal((await call('GET', `/api/v1/matches/${matchId}`, { token: first.token })).body.status, 'cancelled');
      assert.equal((await call('GET', `/api/v1/matches/${matchId}/contacts`, { token: first.token })).status, 404);
      const told = async () =>
        [...(await inboxOf(first.accountId)), ...(await inboxOf(second.accountId))].map(({ type, payload }) => [
          type,
          payload.change,
          payload.match,
        ]);
      const inbox = [
        ['event_changed', 'cancelled', { id: matchId, cancelled: true }],
        ['event_changed', 'cancelled', { id: matchId, cancelled: true }],
      ];
      assert.deepEqual(await told(), inbox);

      await enqueueEventChanged(eventId, 'cancelled');
      await eventually('The second job', async () => ((await finishedJobsOf(eventId)) >= 2 ? true : undefined));
      assert.deepEqual(await told(), inbox, 'the second job tells nobody again');
      assert.deepEqual(await proposalsOf(applicationId), proposals);
    });

    test('a mutual match whose day moved to another time is kept, and both are told', async () => {
      const day = inDays(17);
      const eventId = await newEventAt(at19(day), at21(day));
      const { first, second, matchId, applicationId } = await mutualMatchAt(eventId);
      const at18 = await startAt18(eventId, day);

      const application = await eventually('Moving the application', async () => {
        const body = await applicationOf(first.token, applicationId);
        return body.sessions[0]?.startsAt === at18 ? body : undefined;
      });
      assert.equal(application.status, 'paired');
      assert.deepEqual(await proposalsOf(applicationId), [{ status: 'mutual', cancel_reason: null }]);
      const match = (await call('GET', `/api/v1/matches/${matchId}`, { token: second.token })).body;
      assert.deepEqual(
        match.days.map(({ startsAt }: { startsAt: string }) => startsAt),
        [at18],
      );
      for (const { accountId } of [first, second]) {
        assert.deepEqual(
          (await inboxOf(accountId)).map(({ payload }) => [payload.change, payload.match]),
          [['rescheduled', { id: matchId, cancelled: false }]],
        );
      }
    });

    test('a moved day that only one side waits on leaves their pending proposal as it is', async () => {
      // 19:00 on two days; the second day's session is put at 18:00 by hand, as an earlier schedule would have it.
      const firstDay = inDays(14);
      const secondDay = inDays(15);
      const eventId = await newEventAt(at19(firstDay), at21(secondDay));
      const first = await newCompleteProfile();
      const second = await newCompleteProfile();
      const waiting = await apply(first.token, eventId, { ...answers, dates: [firstDay] });
      const paired = await apply(second.token, eventId, { ...answers, dates: [firstDay, secondDay] });
      assert.equal(paired.body.status, 'paired', 'the two are proposed to each other at once');
      await withDatabase((client) =>
        client.query(
          `UPDATE event_sessions SET starts_at = starts_at - interval '1 hour' WHERE event_id = $1 AND starts_at = $2`,
          [eventId, at19(secondDay)],
        ),
      );

      await enqueueEventChanged(eventId, 'rescheduled');
      await eventually('The job', async () => ((await finishedJobsOf(eventId)) >= 1 ? true : undefined));

      assert.deepEqual(await proposalsOf(waiting.body.id), [{ status: 'proposed', cancel_reason: null }]);
      assert.equal((await applicationOf(first.token, waiting.body.id)).status, 'paired');
      const moved = await applicationOf(second.token, paired.body.id);
      assert.equal(moved.status, 'paired');
      assert.deepEqual(
        moved.sessions.map(({ startsAt }: { startsAt: string }) => startsAt),
        [at19(firstDay), at19(secondDay)],
      );
    });

    test('moved to another hour and back: the first session is scheduled again, and every round runs once', async () => {
      const day = inDays(10);
      const at20 = fromKyivWallClock(`${day}T20:00:00Z`).toISOString();
      const at22 = fromKyivWallClock(`${day}T22:00:00Z`).toISOString();
      const eventId = await newEventAt(at19(day), at21(day));
      const first = await newCompleteProfile();
      const second = await newCompleteProfile();
      // Answers that do not suit each other well enough for an instant match, so a round pairs them.
      await apply(first.token, eventId, { desiredCompany: 'friends', afterEventPlans: [] });
      await apply(second.token, eventId);
      const edit = (startsAt: string, endsAt: string) =>
        call('PUT', `/api/v1/events/${eventId}`, { token: tokens.org, body: { ...newEvent, startsAt, endsAt } });

      assert.equal((await edit(at20, at22)).status, 200);
      await eventually('The move', async () => ((await finishedJobsOf(eventId)) >= 1 ? true : undefined));
      assert.equal((await edit(at19(day), at21(day))).status, 200);
      await eventually('The move back', async () => ((await finishedJobsOf(eventId)) >= 2 ? true : undefined));

      const sessions = await withDatabase(async (client) => {
        const { rows } = await client.query<{ id: string; status: string; starts_at: Date }>(
          'SELECT id, status, starts_at FROM event_sessions WHERE event_id = $1 ORDER BY starts_at',
          [eventId],
        );
        return rows;
      });
      assert.deepEqual(
        sessions.map(({ status, starts_at }) => [status, starts_at.toISOString()]),
        [
          ['scheduled', at19(day)],
          ['cancelled', at20],
        ],
      );
      const rounds = (sessionId: string) =>
        withDatabase(async (client) => {
          const { rows } = await client.query<{ start_after: Date; state: string }>(
            `SELECT start_after, state::text AS state FROM pgboss.job
             WHERE name = 'matching.round' AND data->>'sessionId' = $1 ORDER BY start_after`,
            [sessionId],
          );
          return rows;
        });
      const [first19, moved20] = sessions;
      const offsetsHours = [7 * 24, 3 * 24, 24, 6];
      const roundsAt = (start: string) =>
        offsetsHours.map((hours) => new Date(Date.parse(start) - hours * 60 * 60 * 1000).toISOString());
      assert.deepEqual(
        (await rounds(first19!.id)).map(({ start_after }) => start_after.toISOString()),
        roundsAt(at19(day)),
        'the first session keeps its four rounds, none planned twice',
      );
      assert.deepEqual(
        (await rounds(moved20!.id)).map(({ start_after }) => start_after.toISOString()),
        roundsAt(at20),
        'the session of the move had its own rounds',
      );

      // Every round job is due now: the first session's run once each, the cancelled session's do nothing.
      await withDatabase((client) =>
        client.query(
          `UPDATE pgboss.job SET start_after = now() WHERE name = 'matching.round' AND data->>'sessionId' = ANY($1)`,
          [[first19!.id, moved20!.id]],
        ),
      );
      const states = await eventually('Running the rounds', async () => {
        const all = [...(await rounds(first19!.id)), ...(await rounds(moved20!.id))].map(({ state }) => state);
        return all.every((state) => state === 'completed') ? all : undefined;
      });
      assert.equal(states.length, 8);
      const { rows } = await withDatabase((client) =>
        client.query(
          `SELECT m.status, m.source FROM matches m JOIN applications a ON a.id = m.application_a_id WHERE a.event_id = $1`,
          [eventId],
        ),
      );
      assert.deepEqual(rows, [{ status: 'proposed', source: 'round' }], 'the first round paired them, once');
    });

    test('an edit that changes no session time enqueues nothing', async () => {
      const day = inDays(11);
      const eventId = await newEventAt(at19(day), at21(day));

      const edited = await call('PUT', `/api/v1/events/${eventId}`, {
        token: tokens.org,
        body: { ...newEvent, title: 'Film quiz night, with prizes', startsAt: at19(day), endsAt: at21(day) },
      });

      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      const { rows } = await withDatabase((client) =>
        client.query(`SELECT id FROM pgboss.job WHERE name = 'event.changed' AND data->>'eventId' = $1`, [eventId]),
      );
      assert.deepEqual(rows, []);
    });

    // ADR-006, decision 10: as the import does it, with its own role, connection and send-only queue (`--once`).
    test('the import cancels 100 events and enqueues their jobs in one transaction, and a rolled back one leaves no job', async (t) => {
      const provider = `e2e-bulk-${randomUUID().slice(0, 8)}`;
      await withDatabase((client) =>
        client.query(
          `INSERT INTO events (title, description, category_id, venue_id, starts_at, ends_at, source, status, provider, external_id)
           SELECT 'Bulk ' || n, 'Gone from the list.', $1, $2, now() + interval '5 days', now() + interval '5 days 2 hours',
                  'import', 'published', $3, 'bulk-' || n
           FROM generate_series(1, 101) AS n`,
          [concerts, arsenalVenue, provider],
        ),
      );
      const statuses = () =>
        withDatabase(async (client) => {
          const { rows } = await client.query<{ status: string; events: number }>(
            'SELECT status, count(*)::int AS events FROM events WHERE provider = $1 GROUP BY status ORDER BY status',
            [provider],
          );
          return Object.fromEntries(rows.map(({ status, events }) => [status, events]));
        });
      const jobs = () =>
        withDatabase(async (client) => {
          const { rows } = await client.query<{ change: string }>(
            `SELECT data->>'change' AS change FROM pgboss.job
             WHERE name = 'event.changed' AND data->>'eventId' IN (SELECT id::text FROM events WHERE provider = $1)`,
            [provider],
          );
          return rows.map(({ change }) => change);
        });

      const importUrl = process.env.IMPORT_DATABASE_URL;
      process.env.IMPORT_DATABASE_URL = runDatabaseUrl('IMPORT_DATABASE_URL');
      const prisma = new ImportPrismaService();
      process.env.IMPORT_DATABASE_URL = importUrl;
      const repository = new PrismaImportedEventsRepository(prisma);
      const transactions = new PrismaTransactionRunner(prisma);
      const queue = new PgBossJobQueue(runDatabaseUrl('IMPORT_DATABASE_URL'), { sendOnly: true });
      queue.onApplicationBootstrap();
      const range = {
        from: new Date().toISOString(),
        to: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const cancelUnseen = (commit: boolean) =>
        transactions.run(async (tx) => {
          const cancelled = await repository.cancelUnseen(provider, ['bulk-101'], range, tx);
          await queue.enqueueMany(
            'event.changed',
            cancelled.map((eventId) => ({ eventId, change: 'cancelled' })),
            tx,
          );
          if (!commit) {
            throw new Error('rolled back');
          }
          return cancelled.length;
        });
      try {
        await assert.rejects(cancelUnseen(false), /rolled back/);
        assert.deepEqual(await statuses(), { published: 101 });
        assert.deepEqual(await jobs(), []);

        const started = performance.now();
        const cancelled = await cancelUnseen(true);
        const elapsedMs = Math.round(performance.now() - started);
        t.diagnostic(`cancelling 100 events with their event.changed jobs took ${elapsedMs} ms in one transaction`);

        assert.equal(cancelled, 100);
        assert.deepEqual(await statuses(), { cancelled: 100, published: 1 });
        assert.deepEqual(
          await jobs(),
          Array.from({ length: 100 }, () => 'cancelled'),
        );
        assert.ok(elapsedMs < 5_000, `${elapsedMs} ms is over the 5 s a Prisma transaction may take`);
      } finally {
        await queue.onModuleDestroy();
        await prisma.$disconnect();
        // The API would take these one by one; they have no applicants, so they are removed instead of awaited.
        await withDatabase((client) =>
          client.query(
            `DELETE FROM pgboss.job WHERE name = 'event.changed' AND state::text = 'created'
               AND data->>'eventId' IN (SELECT id::text FROM events WHERE provider = $1)`,
            [provider],
          ),
        );
      }
    });
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

  // SEC-001: an endpoint the caller may not use answers as if it did not exist.
  test('answers a signed-in user who is not an administrator with 404', async () => {
    assertRejected(await call('GET', '/api/v1/admin/categories', { token: tokens.user }), 404, 'NOT_FOUND');
  });
});

describe('GET /api/v1/admin/categories/{id}', () => {
  test('returns the category', async () => {
    const res = await call('GET', `/api/v1/admin/categories/${concerts}`, { token: tokens.admin });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: concerts, name: 'Концерти', slug: 'concerts', isActive: true });
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

  test('makes the slug from the name, in Latin', async () => {
    const suffix = randomUUID().slice(0, 8);
    const res = await call('POST', '/api/v1/admin/categories', {
      token: tokens.admin,
      body: { name: `Майстер-класи ${suffix}` },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.slug, `maister-klasy-${suffix}`);
  });

  test('adds a number to a slug another category has', async () => {
    const suffix = randomUUID().slice(0, 8);
    const first = await call('POST', '/api/v1/admin/categories', {
      token: tokens.admin,
      body: { name: `Кіно ${suffix}` },
    });
    const second = await call('POST', '/api/v1/admin/categories', {
      token: tokens.admin,
      body: { name: `Кіно, ${suffix}!` },
    });
    assert.equal(first.body.slug, `kino-${suffix}`);
    assert.equal(second.status, 201);
    assert.equal(second.body.slug, `kino-${suffix}-2`);
  });

  test('saves the name with single spaces and ʼ for every apostrophe', async () => {
    const suffix = randomUUID().slice(0, 8);
    const res = await call('POST', '/api/v1/admin/categories', {
      token: tokens.admin,
      body: { name: `  Кав'ярні   ${suffix} ` },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, `Кавʼярні ${suffix}`);
  });

  // The name is compared in lower case, trimmed, with runs of spaces as one and every apostrophe alike.
  for (const { title, variant } of [
    { title: 'in another case', variant: (suffix: string) => `КАВʼЯРНІ ${suffix.toUpperCase()}` },
    { title: 'with extra spaces', variant: (suffix: string) => `  Кавʼярні    ${suffix}  ` },
    { title: "with ' as the apostrophe", variant: (suffix: string) => `Кав'ярні ${suffix}` },
    { title: 'with ’ as the apostrophe', variant: (suffix: string) => `Кав’ярні ${suffix}` },
  ]) {
    test(`rejects a name that differs from another one only ${title} with 409`, async () => {
      const suffix = randomUUID().slice(0, 8);
      const first = await call('POST', '/api/v1/admin/categories', {
        token: tokens.admin,
        body: { name: `Кавʼярні ${suffix}` },
      });
      assert.equal(first.status, 201);

      const res = await call('POST', '/api/v1/admin/categories', {
        token: tokens.admin,
        body: { name: variant(suffix) },
      });

      assertRejected(res, 409, 'CONFLICT');
    });
  }

  test('rejects a slug in the body with 400', async () => {
    const res = await call('POST', '/api/v1/admin/categories', {
      token: tokens.admin,
      body: { name: `E2E ${randomUUID().slice(0, 8)}`, slug: 'my-own' },
    });
    assert.equal(res.status, 400);
  });

  test('rejects an empty name with 400', async () => {
    const res = await call('POST', '/api/v1/admin/categories', { token: tokens.admin, body: { name: '' } });
    assertInvalid(res, 'body', 'name');
  });

  test('rejects a form-encoded body with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/categories`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tokens.admin}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: 'Майстер-класи' }).toString(),
    });
    assert.equal(res.status, 400);
  });
});

describe('PATCH /api/v1/admin/categories/{id}', () => {
  test('renames a category and keeps its slug', async () => {
    const created = await newCategory();
    const before = await call('GET', `/api/v1/admin/categories/${created.id}`, { token: tokens.admin });
    const res = await call('PATCH', `/api/v1/admin/categories/${created.id}`, {
      token: tokens.admin,
      body: { name: `Renamed ${randomUUID().slice(0, 8)}` },
    });
    assert.equal(res.status, 200);
    assert.notEqual(res.body.name, created.name);
    assert.equal(res.body.slug, before.body.slug);
  });

  test('rejects a rename to the name of another category, in another case and with ’, with 409', async () => {
    const suffix = randomUUID().slice(0, 8);
    await call('POST', '/api/v1/admin/categories', { token: tokens.admin, body: { name: `Кавʼярні ${suffix}` } });
    const other = await newCategory();

    const res = await call('PATCH', `/api/v1/admin/categories/${other.id}`, {
      token: tokens.admin,
      body: { name: ` кав’ярні  ${suffix}` },
    });

    assertRejected(res, 409, 'CONFLICT');
  });

  test('rejects a slug in the body with 400 and keeps the slug', async () => {
    const res = await call('PATCH', `/api/v1/admin/categories/${concerts}`, {
      token: tokens.admin,
      body: { slug: 'gigs' },
    });
    assert.equal(res.status, 400);
    const after = await call('GET', `/api/v1/admin/categories/${concerts}`, { token: tokens.admin });
    assert.equal(after.body.slug, 'concerts');
  });

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

  test('rejects a category that events and listings use with 409', async () => {
    const res = await call('DELETE', `/api/v1/admin/categories/${concerts}`, { token: tokens.admin });
    assertRejected(res, 409, 'CONFLICT');
    assert.equal(res.body.error.message, 'The category is in use; deactivate it instead');
  });

  test('rejects an id that is not a UUID with 400', async () => {
    assertInvalid(await call('DELETE', '/api/v1/admin/categories/not-a-uuid', { token: tokens.admin }), 'params', 'id');
  });
});

// FR-025
describe('POST /api/v1/reports', () => {
  test('reports a user by username with 204, in any case of the letters', async () => {
    const target = await newProfile();
    const res = await call('POST', '/api/v1/reports', {
      token: tokens.user,
      body: { username: target.username.toUpperCase(), reason: 'no_show', comment: 'Did not come.' },
    });
    assert.equal(res.status, 204, JSON.stringify(res.body));
    assert.ok(await openCaseOf(target.accountId));
  });

  test('rejects an unknown username with 422 REFERENCE_NOT_FOUND', async () => {
    const res = await call('POST', '/api/v1/reports', {
      token: tokens.user,
      body: { username: `nobody_${randomUUID().slice(0, 8)}`, reason: 'fake_profile' },
    });
    assertRejected(res, 422, 'REFERENCE_NOT_FOUND');
  });

  test('rejects your own username with 422 CANNOT_REPORT_SELF', async () => {
    const res = await call('POST', '/api/v1/reports', {
      token: tokens.user,
      body: { username: 'olena_k', reason: 'other' },
    });
    assertRejected(res, 422, 'CANNOT_REPORT_SELF');
  });

  test('rejects a reason outside the list with 400', async () => {
    const res = await call('POST', '/api/v1/reports', {
      token: tokens.user,
      body: { username: 'taras.m', reason: 'boring' },
    });
    assertInvalid(res, 'body', 'reason');
  });

  test('rejects a guest token with 401', async () => {
    const res = await call('POST', '/api/v1/reports', {
      token: tokens.guest,
      body: { username: 'taras.m', reason: 'other' },
    });
    assertRejected(res, 401, 'UNAUTHENTICATED');
  });
});

// FR-026, FR-027
describe('Report cases', () => {
  test('groups repeated reports on one user into one open case with every report', async () => {
    const target = await newProfile();
    const other = await newAccount();
    for (const [token, comment] of [
      [tokens.user, undefined],
      [tokens.user, 'Second time: rude messages after the event.'],
      [other.token, undefined],
    ] as const) {
      const res = await call('POST', '/api/v1/reports', {
        token,
        body: { username: target.username, reason: 'offensive_messages', comment },
      });
      assert.equal(res.status, 204, JSON.stringify(res.body));
    }
    const caseId = await openCaseOf(target.accountId);

    const list = await call('GET', '/api/v1/admin/report-cases', { token: tokens.admin });
    assert.equal(list.status, 200, JSON.stringify(list.body));
    const listed = list.body.items.find((item: { id: string }) => item.id === caseId);
    assert.equal(listed?.reportCount, 3, JSON.stringify(list.body.items));
    assert.deepEqual(listed.account, { id: target.accountId, username: target.username, displayName: 'Reported' });

    const details = await call('GET', `/api/v1/admin/report-cases/${caseId}`, { token: tokens.admin });
    assert.equal(details.status, 200, JSON.stringify(details.body));
    assert.equal(details.body.status, 'open');
    assert.deepEqual(
      details.body.reports.map((report: { reporter: { username: string | null }; comment: string | null }) => [
        report.reporter.username,
        report.comment,
      ]),
      [
        ['olena_k', null],
        ['olena_k', 'Second time: rude messages after the event.'],
        [null, null],
      ],
    );
  });

  test('bans the reported user: their session gets 401 and the case is resolved and audited', async () => {
    const target = await newProfile();
    assert.equal((await call('GET', '/api/v1/me/profile', { token: target.token })).status, 200);
    await call('POST', '/api/v1/reports', {
      token: tokens.user,
      body: { username: target.username, reason: 'unsafe_behaviour' },
    });
    const caseId = await openCaseOf(target.accountId);

    const res = await call('POST', `/api/v1/admin/report-cases/${caseId}/ban`, { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'resolved');
    assert.equal(res.body.resolution, 'banned');
    assertRejected(await call('GET', '/api/v1/me/profile', { token: target.token }), 401, 'UNAUTHENTICATED');
    assertRejected(
      await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: target.refreshToken } }),
      401,
      'INVALID_REFRESH_TOKEN',
    );
    assertRejected(
      await call('POST', '/api/v1/auth/google', { body: { idToken: await googleIdToken(target.subject) } }),
      401,
      'INVALID_CREDENTIALS',
    );
    const { rows } = await withDatabase((client) =>
      client.query(`SELECT actor_id, result FROM audit_logs WHERE action = 'account.ban' AND target_id = $1`, [
        target.accountId,
      ]),
    );
    assert.deepEqual(rows, [{ actor_id: stubAccounts.admin.id, result: 'banned' }]);
  });

  test('rejects resolving a resolved case with 409, and a later report opens a new case', async () => {
    const target = await newProfile();
    await call('POST', '/api/v1/reports', { token: tokens.user, body: { username: target.username, reason: 'other' } });
    const caseId = await openCaseOf(target.accountId);

    const dismissed = await call('POST', `/api/v1/admin/report-cases/${caseId}/dismiss`, { token: tokens.admin });
    assert.equal(dismissed.status, 200, JSON.stringify(dismissed.body));
    assert.equal(dismissed.body.resolution, 'dismissed');
    const again = await call('POST', `/api/v1/admin/report-cases/${caseId}/ban`, { token: tokens.admin });
    assertRejected(again, 409, 'CONFLICT');
    assert.equal((await call('GET', '/api/v1/me/profile', { token: target.token })).status, 200);

    await call('POST', '/api/v1/reports', { token: tokens.user, body: { username: target.username, reason: 'other' } });
    const newCaseId = await openCaseOf(target.accountId);
    assert.ok(newCaseId && newCaseId !== caseId);
  });

  test('bans again on a case already banned, so a ban that failed halfway can be retried', async () => {
    const target = await newProfile();
    const caseId = await reportAndResolve(target.username, target.accountId, 'ban');

    const again = await call('POST', `/api/v1/admin/report-cases/${caseId}/ban`, { token: tokens.admin });

    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.resolution, 'banned');
  });

  test('stores no report on a banned user, and still answers 204', async () => {
    const target = await newProfile();
    await reportAndResolve(target.username, target.accountId, 'ban');

    const res = await call('POST', '/api/v1/reports', {
      token: tokens.user,
      body: { username: target.username, reason: 'other' },
    });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    assert.equal(await openCaseOf(target.accountId), undefined);
  });

  test('puts two first reports sent at once into one case', async () => {
    const target = await newProfile();
    const other = await newAccount();

    const results = await Promise.all(
      [tokens.user, other.token].map((token) =>
        call('POST', '/api/v1/reports', { token, body: { username: target.username, reason: 'fake_profile' } }),
      ),
    );

    assert.deepEqual(
      results.map((res) => res.status),
      [204, 204],
    );
    const caseId = await openCaseOf(target.accountId);
    const details = await call('GET', `/api/v1/admin/report-cases/${caseId}`, { token: tokens.admin });
    assert.equal(details.body.reportCount, 2, JSON.stringify(details.body));
  });

  test('lists resolved cases on request, a page at a time', async () => {
    for (const target of [await newProfile(), await newProfile()]) {
      await reportAndResolve(target.username, target.accountId, 'dismiss');
    }

    const res = await call('GET', '/api/v1/admin/report-cases?status=resolved&limit=1', { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].status, 'resolved');
    assert.equal(res.body.page.hasMore, true);
  });

  test('puts a report that arrives while its case is being resolved into a new case', async () => {
    const target = await newProfile();
    await call('POST', '/api/v1/reports', { token: tokens.user, body: { username: target.username, reason: 'other' } });
    const caseId = await openCaseOf(target.accountId);
    const admin = new pg.Client({ connectionString: databaseUrl });
    await admin.connect();
    try {
      await admin.query('BEGIN');
      await admin.query(
        `UPDATE report_cases SET status = 'resolved', resolution = 'dismissed', resolved_at = now() WHERE id = $1`,
        [caseId],
      );
      // The report still sees the case open and waits on its row lock until the resolution commits.
      const report = call('POST', '/api/v1/reports', {
        token: tokens.user,
        body: { username: target.username, reason: 'no_show' },
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await admin.query('COMMIT');
      assert.equal((await report).status, 204);
    } finally {
      await admin.end();
    }

    const { rows } = await withDatabase((client) =>
      client.query(
        `SELECT c.status, count(r.id)::int AS reports FROM report_cases c JOIN reports r ON r.case_id = c.id
         WHERE c.target_account_id = $1 GROUP BY c.id, c.status ORDER BY c.status`,
        [target.accountId],
      ),
    );
    assert.deepEqual(rows, [
      { status: 'open', reports: 1 },
      { status: 'resolved', reports: 1 },
    ]);
  });

  test('answers 404 to an unknown case', async () => {
    const res = await call('POST', `/api/v1/admin/report-cases/${randomUUID()}/ban`, { token: tokens.admin });
    assertRejected(res, 404, 'NOT_FOUND');
  });

  // SEC-001: an endpoint the caller may not use answers as if it did not exist.
  test('answers a signed-in user who is not an administrator with 404', async () => {
    assertRejected(await call('GET', '/api/v1/admin/report-cases', { token: tokens.user }), 404, 'NOT_FOUND');
  });
});

// FR-026, FR-028
describe('Listing report cases', () => {
  test('groups reports on someone else’s listing into one case that shows the listing and its author', async () => {
    const author = await newProfile();
    const listing = await call('POST', '/api/v1/listings', { token: author.token, body: newListing });
    const other = await newAccount();
    for (const token of [tokens.user, tokens.user, other.token]) {
      const res = await call('POST', '/api/v1/reports', {
        token,
        body: { listingId: listing.body.id, reason: 'offensive_messages', comment: 'Rude text.' },
      });
      assert.equal(res.status, 204, JSON.stringify(res.body));
    }
    const caseId = await openListingCaseOf(listing.body.id);

    let listed;
    for (let offset = 0, hasMore = true; !listed && hasMore; offset += 20) {
      const page = await call('GET', `/api/v1/admin/report-cases?offset=${offset}`, { token: tokens.admin });
      listed = page.body.items.find((item: { id: string }) => item.id === caseId);
      hasMore = page.body.page.hasMore;
    }
    const details = await call('GET', `/api/v1/admin/report-cases/${caseId}`, { token: tokens.admin });
    const { reports: _reports, ...summary } = details.body;
    assert.deepEqual(listed, summary);
    assert.equal(details.body.targetType, 'listing');
    assert.equal(details.body.reportCount, 3);
    assert.equal(details.body.reports.length, 3);
    assert.deepEqual(details.body.account, {
      id: author.accountId,
      username: author.username,
      displayName: 'Reported',
    });
    assert.deepEqual(details.body.listing, {
      id: listing.body.id,
      title: newListing.title,
      description: newListing.description,
      date: newListing.date,
      status: 'active',
    });
  });

  test('shows no listing in a user case', async () => {
    const target = await newProfile();
    await call('POST', '/api/v1/reports', { token: tokens.user, body: { username: target.username, reason: 'other' } });

    const details = await call('GET', `/api/v1/admin/report-cases/${await openCaseOf(target.accountId)}`, {
      token: tokens.admin,
    });

    assert.equal(details.body.targetType, 'account');
    assert.equal(details.body.listing, null);
  });

  test('rejects your own listing with 422 CANNOT_REPORT_SELF', async () => {
    const res = await call('POST', '/api/v1/reports', {
      token: tokens.user,
      body: { listingId: olenasListing, reason: 'other' },
    });
    assertRejected(res, 422, 'CANNOT_REPORT_SELF');
  });

  test('rejects an unknown or removed listing with 422 REFERENCE_NOT_FOUND', async () => {
    const author = await newProfile();
    const removed = await call('POST', '/api/v1/listings', { token: author.token, body: newListing });
    await call('DELETE', `/api/v1/listings/${removed.body.id}`, { token: author.token });

    for (const listingId of [randomUUID(), removed.body.id]) {
      const res = await call('POST', '/api/v1/reports', { token: tokens.user, body: { listingId, reason: 'other' } });
      assertRejected(res, 422, 'REFERENCE_NOT_FOUND');
    }
  });

  test('rejects a report with both a username and a listing, or with neither, with 400', async () => {
    for (const body of [{ username: 'taras.m', listingId: tarasListing, reason: 'other' }, { reason: 'other' }]) {
      assertInvalid(await call('POST', '/api/v1/reports', { token: tokens.user, body }), 'body', '');
    }
  });

  test('removes the reported listing: it leaves the feed, its page answers 404, and it is audited', async () => {
    const { listingId, caseId } = await newReportedListing();

    const res = await call('POST', `/api/v1/admin/report-cases/${caseId}/remove-listing`, { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.resolution, 'removed');
    assert.equal(res.body.listing.status, 'removed');
    assertRejected(await call('GET', `/api/v1/listings/${listingId}`, { token: tokens.user }), 404, 'NOT_FOUND');
    for (let offset = 0, hasMore = true; hasMore; offset += 20) {
      const page = await call('GET', `/api/v1/listings?offset=${offset}`, { token: tokens.user });
      assert.ok(!page.body.items.some((item: { id: string }) => item.id === listingId));
      hasMore = page.body.page.hasMore;
    }
    const { rows } = await withDatabase((client) =>
      client.query(`SELECT actor_id, action, result FROM audit_logs WHERE target_id = $1 ORDER BY id`, [listingId]),
    );
    assert.deepEqual(rows, [
      { actor_id: stubAccounts.user.id, action: 'report.create', result: 'created' },
      { actor_id: stubAccounts.admin.id, action: 'listing.remove', result: 'removed' },
    ]);
  });

  test('removes again on a case already removed, so a removal that failed halfway can be retried', async () => {
    const { caseId } = await newReportedListing();
    await call('POST', `/api/v1/admin/report-cases/${caseId}/remove-listing`, { token: tokens.admin });

    const again = await call('POST', `/api/v1/admin/report-cases/${caseId}/remove-listing`, { token: tokens.admin });

    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.resolution, 'removed');
  });

  test('dismisses a listing case and leaves the listing in the feed', async () => {
    const { listingId, caseId } = await newReportedListing();

    const res = await call('POST', `/api/v1/admin/report-cases/${caseId}/dismiss`, { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.resolution, 'dismissed');
    assert.equal((await call('GET', `/api/v1/listings/${listingId}`, { token: tokens.user })).status, 200);
    assertRejected(
      await call('POST', `/api/v1/admin/report-cases/${caseId}/remove-listing`, { token: tokens.admin }),
      409,
      'CONFLICT',
    );
  });

  test('refuses a ban on a listing case and a removal on a user case with 409, and audits both', async () => {
    const { author, caseId: listingCaseId } = await newReportedListing();
    const target = await newProfile();
    await call('POST', '/api/v1/reports', { token: tokens.user, body: { username: target.username, reason: 'other' } });
    const userCaseId = await openCaseOf(target.accountId);

    const ban = await call('POST', `/api/v1/admin/report-cases/${listingCaseId}/ban`, { token: tokens.admin });
    const removal = await call('POST', `/api/v1/admin/report-cases/${userCaseId}/remove-listing`, {
      token: tokens.admin,
    });

    assertRejected(ban, 409, 'CONFLICT');
    assertRejected(removal, 409, 'CONFLICT');
    assert.equal((await call('GET', '/api/v1/me/profile', { token: author.token })).status, 200);
    const { rows } = await withDatabase((client) =>
      client.query(
        `SELECT action, result FROM audit_logs WHERE target_id IN ($1, $2) AND result LIKE 'refused%' ORDER BY action`,
        [listingCaseId, userCaseId],
      ),
    );
    assert.deepEqual(rows, [
      { action: 'account.ban', result: 'refused: listing case' },
      { action: 'listing.remove', result: 'refused: account case' },
    ]);
  });

  // SEC-001
  test('answers a signed-in user who is not an administrator with 404', async () => {
    const { caseId } = await newReportedListing();

    const res = await call('POST', `/api/v1/admin/report-cases/${caseId}/remove-listing`, { token: tokens.user });

    assertRejected(res, 404, 'NOT_FOUND');
  });
});

// FR-003
describe('Organization verification', () => {
  const request = {
    name: 'Riverside Stage',
    description: 'Open-air concerts by the Dnipro.',
    officialLink: 'https://riverside.example.org',
  };

  /** A new account with a pending organization request; its token and account id. */
  async function newRequest(): Promise<{ token: string; accountId: string }> {
    const { token } = await newAccount();
    const res = await call('PUT', '/api/v1/me/organization', { token, body: request });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return { token, accountId: accountIdOf(token) };
  }

  async function decide(accountId: string, decision: 'approve' | 'reject', token = tokens.admin): Promise<Response> {
    return call('POST', `/api/v1/admin/organizations/${accountId}/${decision}`, { token });
  }

  async function auditOf(accountId: string): Promise<{ action: string; result: string }[]> {
    const { rows } = await withDatabase((client) =>
      client.query(`SELECT action, result FROM audit_logs WHERE target_id = $1 ORDER BY id`, [accountId]),
    );
    return rows;
  }

  test('keeps the Instagram username bare, and refuses one that does not fit', async () => {
    const { token } = await newAccount();
    const saved = await call('PUT', '/api/v1/me/organization', {
      token,
      body: { ...request, instagram: 'https://www.instagram.com/riverside.stage/' },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.instagram, 'riverside.stage');

    const refused = await call('PUT', '/api/v1/me/organization', { token, body: { ...request, instagram: '..nope' } });
    assertRejected(refused, 422, 'INVALID_SOCIAL_HANDLE');
  });

  test('saves a request as pending, shows it to the account, and keeps it from publishing events', async () => {
    const { token } = await newAccount();
    assertRejected(await call('GET', '/api/v1/me/organization', { token }), 404, 'NOT_FOUND');

    const res = await call('PUT', '/api/v1/me/organization', { token, body: request });

    const pending = { ...request, instagram: null, verificationStatus: 'pending', verifiedAt: null, logo: null };
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, pending);
    assert.deepEqual((await call('GET', '/api/v1/me/organization', { token })).body, pending);
    assertRejected(await call('POST', '/api/v1/events', { token, body: newEvent }), 422, 'ORGANIZATION_NOT_VERIFIED');
  });

  test('lists the requests for administrators, pending ones first', async () => {
    const { accountId } = await newRequest();

    let items: { accountId: string; verificationStatus: string; account: unknown }[] = [];
    for (let offset = 0, hasMore = true; hasMore; offset += 20) {
      const page = await call('GET', `/api/v1/admin/organizations?offset=${offset}`, { token: tokens.admin });
      assert.equal(page.status, 200, JSON.stringify(page.body));
      items = [...items, ...page.body.items];
      hasMore = page.body.page.hasMore;
    }

    const statuses = items.map((item) => item.verificationStatus);
    assert.ok(statuses.lastIndexOf('pending') < statuses.indexOf('verified'), JSON.stringify(statuses));
    const listed = items.find((item) => item.accountId === accountId);
    assert.equal(listed?.verificationStatus, 'pending');
    assert.deepEqual(listed.account, { id: accountId, username: null, displayName: null });
  });

  test('verifies a request: the organization can publish, and who verified it and when is recorded and audited', async () => {
    const { token, accountId } = await newRequest();

    const res = await decide(accountId, 'approve');

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.verificationStatus, 'verified');
    assert.ok(res.body.verifiedAt);
    const { rows } = await withDatabase((client) =>
      client.query(`SELECT verified_by, verified_at FROM organizations WHERE account_id = $1`, [accountId]),
    );
    assert.equal(rows[0].verified_by, stubAccounts.admin.id);
    assert.equal(rows[0].verified_at.toISOString(), res.body.verifiedAt);
    assert.deepEqual(await auditOf(accountId), [{ action: 'organization.approve', result: 'verified' }]);
    const venueId = randomUUID();
    await withDatabase((client) =>
      client.query(
        `INSERT INTO venues (id, name, address, latitude, longitude, source, organization_id)
         VALUES ($1, 'Riverside lawn', 'Naberezhna St, Kyiv', 50.45, 30.53, 'organization', $2)`,
        [venueId, accountId],
      ),
    );
    const event = await call('POST', '/api/v1/events', { token, body: { ...newEvent, venueId } });
    assert.equal(event.status, 201, JSON.stringify(event.body));
  });

  test('rejects a request, which the account can then send again', async () => {
    const { token, accountId } = await newRequest();

    const res = await decide(accountId, 'reject');

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.verificationStatus, 'rejected');
    assert.equal((await call('GET', '/api/v1/me/organization', { token })).body.verificationStatus, 'rejected');
    assert.deepEqual(await auditOf(accountId), [{ action: 'organization.reject', result: 'rejected' }]);
    const again = await call('PUT', '/api/v1/me/organization', { token, body: { ...request, name: 'Riverside' } });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.verificationStatus, 'pending');
    assert.equal(again.body.name, 'Riverside');
  });

  test('refuses decisions on a request that is not pending, and a new request of a verified organization, with 409', async () => {
    const { token, accountId } = await newRequest();
    await decide(accountId, 'approve');

    assertRejected(await decide(accountId, 'approve'), 409, 'CONFLICT');
    assertRejected(await decide(accountId, 'reject'), 409, 'CONFLICT');
    assertRejected(await call('PUT', '/api/v1/me/organization', { token, body: request }), 409, 'CONFLICT');
    assert.deepEqual((await auditOf(accountId)).slice(1), [
      { action: 'organization.approve', result: 'refused: not pending' },
      { action: 'organization.reject', result: 'refused: not pending' },
    ]);
  });

  test('refuses an administrator’s decision on their own request with 409 CANNOT_DECIDE_OWN_REQUEST', async () => {
    const admin = await call('PUT', '/api/v1/me/organization', { token: tokens.admin, body: request });
    assert.equal(admin.status, 200, JSON.stringify(admin.body));

    assertRejected(await decide(stubAccounts.admin.id, 'approve'), 409, 'CANNOT_DECIDE_OWN_REQUEST');
    assert.equal(
      (await call('GET', '/api/v1/me/organization', { token: tokens.admin })).body.verificationStatus,
      'pending',
    );
  });

  test('answers 404 to an account without a request', async () => {
    assertRejected(await decide(randomUUID(), 'approve'), 404, 'NOT_FOUND');
  });

  test('rejects an official link that is not an http or https address with 400', async () => {
    for (const officialLink of ['ftp://riverside.example.org', 'riverside']) {
      const res = await call('PUT', '/api/v1/me/organization', {
        token: tokens.user,
        body: { ...request, officialLink },
      });
      assertInvalid(res, 'body', 'officialLink');
    }
  });

  // SEC-001
  test('answers a user who is not an administrator with 404, and a guest with 401', async () => {
    const { accountId } = await newRequest();

    assertRejected(await call('GET', '/api/v1/admin/organizations', { token: tokens.user }), 404, 'NOT_FOUND');
    assertRejected(await decide(accountId, 'approve', tokens.user), 404, 'NOT_FOUND');
    assertRejected(await call('GET', '/api/v1/me/organization', { token: tokens.guest }), 401, 'UNAUTHENTICATED');
  });
});

// FR-027: the admin panel lists every account, event, venue and organization.
describe('Admin panel lists', () => {
  const podilFilmClub = { accountId: stubAccounts.org.id, name: 'Podil Film Club' };

  async function listAll(path: string): Promise<Response['body'][]> {
    let items: Response['body'][] = [];
    for (let offset = 0, hasMore = true; hasMore; offset += 20) {
      const separator = path.includes('?') ? '&' : '?';
      const page = await call('GET', `${path}${separator}offset=${offset}`, { token: tokens.admin });
      assert.equal(page.status, 200, JSON.stringify(page.body));
      items = [...items, ...page.body.items];
      hasMore = page.body.page.hasMore;
    }
    return items;
  }

  test('lists an account with its profile, organization and age, never its phone or date of birth', async () => {
    const items = await listAll('/api/v1/admin/accounts?search=OLENA_K');

    assert.deepEqual(items, [
      {
        id: stubAccounts.user.id,
        role: 'user',
        status: 'active',
        signInMethods: ['google'],
        age: ageOn(kyivDate(), stubAccounts.user.dateOfBirth),
        createdAt: items[0]?.createdAt,
        profile: { username: 'olena_k', displayName: 'Olena' },
        organization: null,
      },
    ]);
  });

  test('finds an account by its id, with its organization request', async () => {
    const items = await listAll(`/api/v1/admin/accounts?search=${stubAccounts.org.id}`);

    assert.deepEqual(
      items.map(({ id, organization }) => ({ id, organization })),
      [{ id: stubAccounts.org.id, organization: { name: 'Podil Film Club', verificationStatus: 'verified' } }],
    );
  });

  test('lists only the administrators with role=admin, newest first', async () => {
    const items = await listAll('/api/v1/admin/accounts?role=admin');

    assert.ok(items.length > 0);
    assert.ok(
      items.every((item) => item.role === 'admin'),
      JSON.stringify(items),
    );
    assert.ok(items.some((item) => item.id === stubAccounts.admin.id));
    const created = items.map((item) => item.createdAt);
    assert.deepEqual(created, [...created].sort().reverse());
  });

  test('gives an empty page when nothing matches the search', async () => {
    const res = await call('GET', '/api/v1/admin/accounts?search=no-such-user-anywhere', { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { items: [], page: { limit: 20, offset: 0, hasMore: false } });
  });

  test('gives one account with its profile as other users see it', async () => {
    const res = await call('GET', `/api/v1/admin/accounts/${stubAccounts.user.id}`, { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.profile.username, 'olena_k');
    assert.equal(res.body.profile.description, 'Cinema, galleries and long walks.');
    assert.ok(res.body.profile.interests.some((interest: { id: string }) => interest.id === interestFilms));
    assert.equal(res.body.organization, null);
    assert.equal('dateOfBirth' in res.body, false);
    assert.equal('phone' in res.body, false);
  });

  test('lists upcoming events in any status, with who added them', async () => {
    const items = await listAll('/api/v1/admin/events');

    const byId = new Map(items.map((item) => [item.id, item]));
    assert.deepEqual(byId.get(cancelledFilmEvent)?.organization, podilFilmClub);
    assert.equal(byId.get(cancelledFilmEvent)?.status, 'cancelled');
    assert.equal(byId.get(arsenalExhibition)?.organization, null);
    const starts = items.map((item) => item.startsAt);
    assert.deepEqual(starts, [...starts].sort());
  });

  test('lists past events latest first, and filters events', async () => {
    const pastEvent = randomUUID();
    await withDatabase((client) =>
      client.query(
        `INSERT INTO events (id, category_id, venue_id, organization_id, source, title, description, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, 'organization', 'Last year''s film night', '', now() - interval '400 days',
                 now() - interval '399 days')`,
        [pastEvent, concerts, filmClubVenue, stubAccounts.org.id],
      ),
    );

    const past = await listAll('/api/v1/admin/events?period=past');
    const filtered = await listAll(
      `/api/v1/admin/events?organizationId=${stubAccounts.org.id}&status=cancelled&search=SILENT`,
    );

    assert.ok(past.some((item) => item.id === pastEvent));
    assert.ok(!past.some((item) => item.id === arsenalExhibition));
    assert.deepEqual(
      filtered.map((item) => item.id),
      [cancelledFilmEvent],
    );
  });

  test('gives one event, a cancelled one too', async () => {
    const res = await call('GET', `/api/v1/admin/events/${cancelledFilmEvent}`, { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'cancelled');
    assert.deepEqual(res.body.organization, podilFilmClub);
  });

  test('lists venues, imported ones too, and filters them', async () => {
    const arsenal = await listAll('/api/v1/admin/venues?search=lavrska');
    const newGallery = await listAll(`/api/v1/admin/venues?organizationId=${stubAccounts.orgPending.id}`);

    assert.deepEqual(
      arsenal.map(({ id, source, organization }) => ({ id, source, organization })),
      [{ id: arsenalVenue, source: 'import', organization: null }],
    );
    assert.deepEqual(
      newGallery.map(({ id, organization }) => ({ id, organization })),
      [{ id: newGalleryHall, organization: { accountId: stubAccounts.orgPending.id, name: 'New Gallery' } }],
    );
  });

  test('gives one venue with the organization that owns it', async () => {
    const res = await call('GET', `/api/v1/admin/venues/${filmClubVenue}`, { token: tokens.admin });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.name, 'Natalka Park lawn');
    assert.deepEqual(res.body.organization, podilFilmClub);
  });

  test('filters organizations by name and status, and gives one organization', async () => {
    const items = await listAll('/api/v1/admin/organizations?search=podil&status=verified');
    const one = await call('GET', `/api/v1/admin/organizations/${stubAccounts.org.id}`, { token: tokens.admin });

    assert.deepEqual(
      items.map((item) => item.accountId),
      [stubAccounts.org.id],
    );
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.equal(one.body.name, 'Podil Film Club');
    assert.equal(one.body.account.id, stubAccounts.org.id);
  });

  test('answers 404 to an id that does not exist', async () => {
    for (const path of ['accounts', 'events', 'venues', 'organizations']) {
      const res = await call('GET', `/api/v1/admin/${path}/${randomUUID()}`, { token: tokens.admin });
      assertRejected(res, 404, 'NOT_FOUND');
    }
  });

  test('rejects an unknown filter value and an empty search with 400', async () => {
    assertInvalid(await call('GET', '/api/v1/admin/accounts?role=owner', { token: tokens.admin }), 'query', 'role');
    assertInvalid(await call('GET', '/api/v1/admin/events?period=soon', { token: tokens.admin }), 'query', 'period');
    assertInvalid(await call('GET', '/api/v1/admin/venues?search=%20', { token: tokens.admin }), 'query', 'search');
    assertInvalid(await call('GET', '/api/v1/admin/accounts/not-a-uuid', { token: tokens.admin }), 'params', 'id');
  });

  // SEC-001
  test('answers a user who is not an administrator with 404, and a guest with 401', async () => {
    for (const path of [
      '/api/v1/admin/accounts',
      `/api/v1/admin/accounts/${stubAccounts.user.id}`,
      '/api/v1/admin/events',
      `/api/v1/admin/events/${filmNight}`,
      '/api/v1/admin/venues',
      `/api/v1/admin/venues/${filmClubVenue}`,
      `/api/v1/admin/organizations/${stubAccounts.org.id}`,
    ]) {
      assertRejected(await call('GET', path, { token: tokens.user }), 404, 'NOT_FOUND');
      assertRejected(await call('GET', path, { token: tokens.guest }), 401, 'UNAUTHENTICATED');
    }
  });
});

// FR-030
describe('GET /api/v1/admin/stats', () => {
  test('counts active users, upcoming events, matches and open report cases', async () => {
    const res = await call('GET', '/api/v1/admin/stats', { token: tokens.admin });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { rows } = await withDatabase((client) =>
      client.query(`SELECT
        (SELECT count(*)::int FROM accounts WHERE status = 'active') AS users,
        (SELECT count(*)::int FROM matches) AS matches,
        (SELECT count(*)::int FROM report_cases WHERE status = 'open') AS "openReports"`),
    );
    assert.deepEqual({ users: res.body.users, matches: res.body.matches, openReports: res.body.openReports }, rows[0]);
    assert.ok(res.body.events > 0, JSON.stringify(res.body));
    assert.equal(res.body.backup, null);
  });

  test('reports the nightly backups as overdue after one failed', async () => {
    const [good] = await insertBackupNights();
    try {
      const res = await call('GET', '/api/v1/admin/stats', { token: tokens.admin });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.backup, { lastSucceededAt: good.finished_at.toISOString(), overdue: true });
    } finally {
      await withDatabase((client) => client.query('DELETE FROM backup_runs'));
    }
  });

  test('answers a signed-in user who is not an administrator with 404', async () => {
    assertRejected(await call('GET', '/api/v1/admin/stats', { token: tokens.user }), 404, 'NOT_FOUND');
  });
});

// REL-06
describe('GET /api/v1/admin/backups', () => {
  test('has no status and no nights where no backup has run', async () => {
    const res = await call('GET', '/api/v1/admin/backups', { token: tokens.admin });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { status: null, items: [] });
  });

  test('lists the nights newest first, with only what the panel may show', async () => {
    const [good, bad] = await insertBackupNights();
    try {
      const res = await call('GET', '/api/v1/admin/backups', { token: tokens.admin });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body, {
        status: { lastSucceededAt: good.finished_at.toISOString(), overdue: true },
        items: [
          {
            finishedAt: bad.finished_at.toISOString(),
            succeeded: false,
            attempts: 3,
            durationSeconds: 0,
            sizeBytes: null,
            reason: 'unreachable',
          },
          {
            finishedAt: good.finished_at.toISOString(),
            succeeded: true,
            attempts: 1,
            durationSeconds: 12,
            sizeBytes: 4404019,
            reason: null,
          },
        ],
      });
    } finally {
      await withDatabase((client) => client.query('DELETE FROM backup_runs'));
    }
  });

  test('answers a signed-in user who is not an administrator with 404', async () => {
    assertRejected(await call('GET', '/api/v1/admin/backups', { token: tokens.user }), 404, 'NOT_FOUND');
  });
});

describe('GET /api/v1/interests', () => {
  test('lists the interests users can pick', async () => {
    const res = await call('GET', '/api/v1/interests', { token: tokens.user });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length > 0);
    assert.ok(res.body.items.some((interest: { id: string }) => interest.id === interestFilms));
  });

  test('gives each interest a group and lists them group by group, each group by name in Ukrainian order', async () => {
    const res = await call('GET', '/api/v1/interests', { token: tokens.user });
    const items: { name: string; group: string }[] = res.body.items;
    const ukrainian = new Intl.Collator('uk');
    const groups = items.map((interest) => interest.group).filter((group, i, all) => group !== all[i - 1]);

    assert.ok(items.every((interest) => interest.group.length > 0));
    assert.equal(new Set(groups).size, groups.length, 'each group is one run of the list');
    assert.equal(groups[0], 'Музика');
    assert.equal(groups.at(-1), 'Езотерика');
    for (const group of groups) {
      const names = items.filter((interest) => interest.group === group).map((interest) => interest.name);
      assert.deepEqual(names, [...names].sort(ukrainian.compare), group);
    }
    assert.ok(items.some((interest) => interest.name === 'Манґа/Манхва' && interest.group === 'Книги й комікси'));
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
      ['Кіно', 'Малювання'],
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
    assert.equal(res.body.occupation, '');
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
      body: {
        description: 'Walks and films.',
        occupation: 'Student',
        communicationFormat: 'dating',
        sharePhone: false,
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.username, 'Newcomer.One');
    assert.equal(res.body.description, 'Walks and films.');
    assert.equal(res.body.occupation, 'Student');
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

  // The database names this value `casual`; the repository translates it both ways.
  test('stores company and returns it as company', async () => {
    const patched = await call('PATCH', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { communicationFormat: 'company' },
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    assert.equal(patched.body.communicationFormat, 'company');

    const res = await call('GET', '/api/v1/me/profile', { token: tokens.orgPending });
    const stored = await withDatabase((client) =>
      client.query('SELECT communication_format FROM profiles WHERE account_id = $1', [accountIdOf(tokens.orgPending)]),
    );

    assert.equal(res.body.communicationFormat, 'company');
    assert.equal(stored.rows[0]?.communication_format, 'casual');
  });

  // Leaves the profile with a gender, which the interests tests need to complete it.
  test('stores the gender "other" with its description, and drops the description for another gender', async () => {
    const other = await call('PATCH', '/api/v1/me/profile', {
      token: tokens.orgPending,
      body: { gender: 'other', genderDescription: ' Небінарна людина ' },
    });
    assert.equal(other.status, 200, JSON.stringify(other.body));
    assert.deepEqual([other.body.gender, other.body.genderDescription], ['other', 'Небінарна людина']);

    const female = await call('PATCH', '/api/v1/me/profile', { token: tokens.orgPending, body: { gender: 'female' } });

    assert.deepEqual([female.body.gender, female.body.genderDescription], ['female', null]);
  });

  test('rejects the gender "other" without a description with 400', async () => {
    const res = await call('PATCH', '/api/v1/me/profile', { token: tokens.orgPending, body: { gender: 'other' } });

    assertInvalid(res, 'body', 'genderDescription');
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

// Before the interests tests, which expect the profile to have a network.
describe('PUT /api/v1/me/profile/linked-accounts', () => {
  test('replaces the whole set, keeps the bare handles and returns them in order with their links', async () => {
    const res = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.orgPending,
      body: {
        linkedAccounts: [
          { network: 'instagram', username: 'https://instagram.com/newcomer.one' },
          { network: 'telegram', username: '@newcomer' },
        ],
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.linkedAccounts, [
      { network: 'telegram', username: 'newcomer', url: 'https://t.me/newcomer' },
      { network: 'instagram', username: 'newcomer.one', url: 'https://instagram.com/newcomer.one' },
    ]);

    const second = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.orgPending,
      body: { linkedAccounts: [{ network: 'telegram', username: 'newcomer' }] },
    });
    const profile = await call('GET', '/api/v1/me/profile', { token: tokens.orgPending });

    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.deepEqual(profile.body.linkedAccounts, [
      { network: 'telegram', username: 'newcomer', url: 'https://t.me/newcomer' },
    ]);
  });

  // SEC-003: the nickname is personal data.
  test('stores the nickname encrypted', async () => {
    const saved = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.orgPending,
      body: { linkedAccounts: [{ network: 'telegram', username: 'newcomer' }] },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));

    const stored = await withDatabase((client) =>
      client.query('SELECT username FROM linked_accounts WHERE profile_id = $1', [accountIdOf(tokens.orgPending)]),
    );

    assert.equal(stored.rows.length, 1);
    assert.ok(!Buffer.from(stored.rows[0].username).toString('latin1').includes('newcomer'));
  });

  test('rejects an empty list with 422 CONTACT_REQUIRED and changes nothing', async () => {
    const saved = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.orgPending,
      body: { linkedAccounts: [{ network: 'telegram', username: 'newcomer' }] },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const res = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.orgPending,
      body: { linkedAccounts: [] },
    });
    assertRejected(res, 422, 'CONTACT_REQUIRED');
    const profile = await call('GET', '/api/v1/me/profile', { token: tokens.orgPending });
    assert.deepEqual(
      profile.body.linkedAccounts.map((item: { username: string }) => item.username),
      ['newcomer'],
    );
  });

  test('rejects a handle that does not fit the network with 422 INVALID_SOCIAL_HANDLE naming it', async () => {
    const res = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.orgPending,
      body: { linkedAccounts: [{ network: 'whatsapp', username: 'not a phone' }] },
    });
    assertRejected(res, 422, 'INVALID_SOCIAL_HANDLE');
    assert.deepEqual(
      res.body.error.details.map((issue: { field: string }) => issue.field),
      ['linkedAccounts.0.username'],
    );
  });

  test('rejects the same social network twice with 400', async () => {
    const res = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.orgPending,
      body: {
        linkedAccounts: [
          { network: 'telegram', username: 'newcomer' },
          { network: 'telegram', username: 'newcomer2' },
        ],
      },
    });
    assertRejected(res, 400, 'VALIDATION_ERROR');
  });

  test('answers 404 when the profile is not created yet', async () => {
    const res = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      token: tokens.admin,
      body: { linkedAccounts: [{ network: 'telegram', username: 'admin_k' }] },
    });
    assertRejected(res, 404, 'NOT_FOUND');
  });

  test('rejects a request without a token with 401', async () => {
    const res = await call('PUT', '/api/v1/me/profile/linked-accounts', {
      body: { linkedAccounts: [{ network: 'telegram', username: 'guest_k' }] },
    });
    assertRejected(res, 401, 'UNAUTHENTICATED');
  });
});

// FR-032
describe('POST /api/v1/me/profile/safety-notice', () => {
  const acknowledge = (token: string, dontShowAgain: boolean) =>
    call('POST', '/api/v1/me/profile/safety-notice', { token, body: { dontShowAgain } });

  test('moves from not_acknowledged to acknowledged, or to hidden with dontShowAgain, and back', async () => {
    const { token } = await newProfile();
    assert.equal((await call('GET', '/api/v1/me/profile', { token })).body.safetyNotice, 'not_acknowledged');

    const acknowledged = await acknowledge(token, false);
    assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
    assert.equal(acknowledged.body.safetyNotice, 'acknowledged');

    assert.equal((await acknowledge(token, true)).body.safetyNotice, 'hidden');
    assert.equal((await call('GET', '/api/v1/me/profile', { token })).body.safetyNotice, 'hidden');
    assert.equal((await acknowledge(token, false)).body.safetyNotice, 'acknowledged');
  });

  test('rejects a request without dontShowAgain with 400', async () => {
    const { token } = await newProfile();
    assertInvalid(await call('POST', '/api/v1/me/profile/safety-notice', { token, body: {} }), 'body', 'dontShowAgain');
  });

  test('answers 404 before the profile is created', async () => {
    const { token } = await newAccount();
    assertRejected(await acknowledge(token, false), 404, 'NOT_FOUND');
  });

  test('rejects a request without a token with 401', async () => {
    const res = await call('POST', '/api/v1/me/profile/safety-notice', { body: { dontShowAgain: false } });
    assertRejected(res, 401, 'UNAUTHENTICATED');
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
    assert.equal(first.body.isComplete, true, 'format, gender, interests and a network are all set');

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

describe('PUT and DELETE /api/v1/me/profile/photo', () => {
  test('stores the largest square inside the crop as WebP, without metadata', async () => {
    const { token } = await newProfile();
    const res = await upload('/api/v1/me/profile/photo', await testPicture(), { token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual({ width: res.body.photo.width, height: res.body.photo.height }, { width: 300, height: 300 });
    assert.equal(res.body.cover, null);

    const image = await getImage(res.body.photo.id, tokens.user);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/webp');
    assert.equal(image.headers.get('cache-control'), 'private, max-age=31536000, immutable');
    assert.equal(image.metadata?.format, 'webp');
    assert.equal(image.metadata?.width, 300);
    assert.equal(image.metadata?.exif, undefined);
    assert.deepEqual((await call('GET', '/api/v1/me/profile', { token })).body.photo, res.body.photo);
  });

  test('cuts the picked area, after turning the picture by its EXIF orientation', async () => {
    const { token } = await newProfile();
    // Orientation 6 shows the 400 × 300 picture turned a quarter clockwise: 300 × 400, red on top.
    const picture = await testPicture({ orientation: 6 });
    const top = await upload('/api/v1/me/profile/photo', picture, {
      token,
      crop: 'cropLeft=0&cropTop=0&cropWidth=1&cropHeight=0.5',
    });
    assert.equal(top.status, 200, JSON.stringify(top.body));
    const [red, green, blue] = await centreColour((await getImage(top.body.photo.id, token)).bytes);
    assert.ok(red! > 200 && green! < 50 && blue! < 50, `expected red, got ${[red, green, blue]}`);
  });

  test('replacing the photo deletes the old picture', async () => {
    const { token } = await newProfile();
    const first = await upload('/api/v1/me/profile/photo', await testPicture(), { token });
    const second = await upload('/api/v1/me/profile/photo', await testPicture(), { token, contentType: 'image/jpeg' });
    assert.notEqual(second.body.photo.id, first.body.photo.id);
    assert.equal((await getImage(first.body.photo.id, token)).status, 404);
    assert.equal((await getImage(second.body.photo.id, token)).status, 200);
  });

  test('DELETE removes the photo and its picture; without one it changes nothing', async () => {
    const { token } = await newProfile();
    const uploaded = await upload('/api/v1/me/profile/photo', await testPicture(), { token });
    const res = await call('DELETE', '/api/v1/me/profile/photo', { token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.photo, null);
    assert.equal((await getImage(uploaded.body.photo.id, token)).status, 404);
    assert.equal((await call('DELETE', '/api/v1/me/profile/photo', { token })).status, 200);
  });

  test('rejects a file that is not a picture with 422 INVALID_IMAGE', async () => {
    const { token } = await newProfile();
    const res = await upload('/api/v1/me/profile/photo', Buffer.from('not a picture'), { token });
    assertRejected(res, 422, 'INVALID_IMAGE');
  });

  test('rejects another Content-Type with 415 and an empty body with 400', async () => {
    const { token } = await newProfile();
    const gif = await upload('/api/v1/me/profile/photo', Buffer.from('GIF89a'), { token, contentType: 'image/gif' });
    assertRejected(gif, 415, 'UNSUPPORTED_MEDIA_TYPE');
    assertInvalid(await upload('/api/v1/me/profile/photo', Buffer.alloc(0), { token }), 'body', '');
  });

  test('rejects a file over 10 MB with 413', async () => {
    const { token } = await newProfile();
    const res = await upload('/api/v1/me/profile/photo', Buffer.alloc(10 * 1024 * 1024 + 1), { token });
    assertRejected(res, 413, 'PAYLOAD_TOO_LARGE');
  });

  test('rejects a crop past the edge of the picture with 400', async () => {
    const { token } = await newProfile();
    const res = await upload('/api/v1/me/profile/photo', await testPicture(), {
      token,
      crop: 'cropLeft=0.5&cropTop=0&cropWidth=0.6&cropHeight=1',
    });
    assertInvalid(res, 'query', 'cropWidth');
  });

  test('answers 404 without a profile, and 401 without a signed-in account', async () => {
    const picture = await testPicture();
    assertRejected(await upload('/api/v1/me/profile/photo', picture, { token: tokens.admin }), 404, 'NOT_FOUND');
    assertRejected(await upload('/api/v1/me/profile/photo', picture, { token: tokens.guest }), 401, 'UNAUTHENTICATED');
    assertRejected(await upload('/api/v1/me/profile/photo', picture, {}), 401, 'UNAUTHENTICATED');
  });
});

describe('PUT and DELETE /api/v1/me/profile/cover', () => {
  test('keeps the whole picture with a 390:200 crop around the picked area', async () => {
    const { token } = await newProfile();
    const res = await upload('/api/v1/me/profile/cover', await testPicture({ width: 800, height: 600 }), {
      token,
      crop: 'cropLeft=0&cropTop=0.25&cropWidth=1&cropHeight=0.5',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { width, height, crop } = res.body.cover;
    assert.deepEqual({ width, height }, { width: 800, height: 600 });
    assert.equal(crop.width, 585);
    assert.equal(crop.height, 300);
    assert.equal(crop.top, 150);
    const image = await getImage(res.body.cover.id, token);
    assert.equal(image.metadata?.width, 800);
  });

  test('DELETE goes back to the default cover', async () => {
    const { token } = await newProfile();
    await upload('/api/v1/me/profile/cover', await testPicture(), { token });
    const res = await call('DELETE', '/api/v1/me/profile/cover', { token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.cover, null);
  });
});

describe('Event covers', () => {
  const upcoming = () => ({
    ...newEvent,
    startsAt: `${inDays(5)}T19:00:00+03:00`,
    endsAt: `${inDays(5)}T21:00:00+03:00`,
  });

  test('an organization adds a cover cut to 2:1 and kept whole, which a guest sees in the catalog', async () => {
    const created = await call('POST', '/api/v1/events', { token: tokens.org, body: upcoming() });
    assert.equal(created.body.photo, null);

    const res = await upload(
      `/api/v1/events/${created.body.id}/photo`,
      await testPicture({ width: 400, height: 300 }),
      {
        token: tokens.org,
      },
    );

    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { photo } = res.body;
    assert.deepEqual([photo.width, photo.height], [400, 300]);
    assert.deepEqual(photo.crop, { left: 0, top: 50, width: 400, height: 200 });
    const seen = await call('GET', `/api/v1/events/${created.body.id}`, { token: tokens.guest });
    assert.deepEqual(seen.body.photo, photo);
    assert.equal((await getImage(photo.id, tokens.guest)).status, 200);
    const own = await call('GET', '/api/v1/me/events', { token: tokens.org });
    assert.deepEqual(own.body.items.find((event: { id: string }) => event.id === created.body.id).photo, photo);
  });

  test('replacing and removing the cover deletes the old picture', async () => {
    const created = await call('POST', '/api/v1/events', { token: tokens.org, body: upcoming() });
    const path = `/api/v1/events/${created.body.id}/photo`;
    const first = await upload(path, await testPicture(), { token: tokens.org });
    const second = await upload(path, await testPicture(), { token: tokens.org });

    const removed = await call('DELETE', path, { token: tokens.org });

    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.equal(removed.body.photo, null);
    for (const { body } of [first, second]) {
      assert.equal((await getImage(body.photo.id, tokens.org)).status, 404);
    }
  });

  test('answers 404 to another organization and 422 for a cancelled event', async () => {
    const created = await call('POST', '/api/v1/events', { token: tokens.org, body: upcoming() });
    const other = await upload(`/api/v1/events/${created.body.id}/photo`, await testPicture(), {
      token: tokens.orgPending,
    });
    const cancelled = await upload(`/api/v1/events/${cancelledFilmEvent}/photo`, await testPicture(), {
      token: tokens.org,
    });

    assertRejected(other, 404, 'NOT_FOUND');
    assertRejected(cancelled, 422, 'EVENT_CANCELLED');
  });
});

describe('Organization logos', () => {
  /** A new account with a pending organization request. */
  async function newOrganization(): Promise<string> {
    const { token } = await newProfile();
    const requested = await call('PUT', '/api/v1/me/organization', {
      token,
      body: {
        name: 'Riverside Stage',
        description: 'Open-air concerts.',
        officialLink: 'https://riverside.example.org',
      },
    });
    assert.equal(requested.status, 200, JSON.stringify(requested.body));
    assert.equal(requested.body.logo, null);
    return token;
  }

  test('a pending organization adds a square logo, which a guest may load', async () => {
    const token = await newOrganization();

    const res = await upload('/api/v1/me/organization/logo', await testPicture({ width: 400, height: 300 }), { token });

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual([res.body.logo.width, res.body.logo.height], [300, 300]);
    assert.deepEqual((await call('GET', '/api/v1/me/organization', { token })).body.logo, res.body.logo);
    assert.equal((await getImage(res.body.logo.id, tokens.guest)).status, 200);
  });

  test('removing the logo deletes its picture', async () => {
    const token = await newOrganization();
    const uploaded = await upload('/api/v1/me/organization/logo', await testPicture(), { token });

    const removed = await call('DELETE', '/api/v1/me/organization/logo', { token });

    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.equal(removed.body.logo, null);
    assert.equal((await getImage(uploaded.body.logo.id, token)).status, 404);
  });

  test('answers 404 to an account without an organization request', async () => {
    const { token } = await newProfile();

    assertRejected(await upload('/api/v1/me/organization/logo', await testPicture(), { token }), 404, 'NOT_FOUND');
  });
});

describe('GET /api/v1/images/{id}', () => {
  test('answers 404 to a guest for a picture of a person, 404 for an unknown id and 400 for an id that is not a UUID', async () => {
    const { token } = await newProfile();
    const uploaded = await upload('/api/v1/me/profile/photo', await testPicture(), { token });
    assert.equal((await getImage(uploaded.body.photo.id, tokens.guest)).status, 404);
    assertRejected(await call('GET', `/api/v1/images/${randomUUID()}`, { token }), 404, 'NOT_FOUND');
    assertInvalid(await call('GET', '/api/v1/images/not-a-uuid', { token }), 'params', 'id');
  });
});

// The inbox (notifications.md). No sender exists yet (#372), so the tests call notify() on the run's database, as a
// module would, and the running API delivers the jobs.
describe('Notifications', () => {
  let prisma: PrismaService;
  let transactions: PrismaTransactionRunner;
  let jobs: PgBossJobQueue;
  let notifications: NotificationsService;

  /** Notifies the account in a transaction of its own, rolled back when `commit` is false; returns the new row. */
  async function notifyInTransaction(accountId: string, dedupeKey: string, commit = true) {
    const rollback = new Error('rollback');
    let created: Awaited<ReturnType<NotificationsService['notify']>>;
    await transactions
      .run(async (tx) => {
        created = await notifications.notify(accountId, 'report_received', {}, dedupeKey, tx);
        if (!commit) {
          throw rollback;
        }
      })
      .catch((error: unknown) => {
        if (error !== rollback) {
          throw error;
        }
      });
    return created;
  }

  /** A notification for the account, committed; returns its id. */
  async function notified(accountId: string): Promise<string> {
    const created = await notifyInTransaction(accountId, `e2e:${randomUUID()}`);
    assert.ok(created, 'notify stored nothing');
    return created.id;
  }

  const rowsWithKey = (dedupeKey: string) =>
    withDatabase(async (client) => {
      const { rows } = await client.query<{ id: string }>('SELECT id FROM notifications WHERE dedupe_key = $1', [
        dedupeKey,
      ]);
      return rows;
    });

  const deliveryJobsOf = (notificationId: string) =>
    withDatabase(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM pgboss.job WHERE name = 'notifications.deliver' AND data->>'notificationId' = $1`,
        [notificationId],
      );
      return rows;
    });

  before(async () => {
    // PrismaService reads its connection string from the environment when it is created.
    const ownUrl = process.env.MAIN_DATABASE_URL;
    process.env.MAIN_DATABASE_URL = mainDatabaseUrl();
    try {
      prisma = new PrismaService();
    } finally {
      process.env.MAIN_DATABASE_URL = ownUrl;
    }
    transactions = new PrismaTransactionRunner(prisma);
    // Registers no handler: the API's own queue runs notifications.deliver.
    jobs = new PgBossJobQueue(mainDatabaseUrl());
    jobs.onApplicationBootstrap();
    await jobs.whenStarted();
    // Sends nothing itself: the API's own queue delivers, so the push provider is never called here.
    notifications = new NotificationsService(
      {} as MessagingProvider,
      new PrismaNotificationsRepository(prisma),
      new PrismaDeviceTokensRepository(prisma),
      {} as PushProvider,
      jobs,
    );
  });

  after(async () => {
    await jobs?.onModuleDestroy();
    await prisma?.$disconnect();
  });

  describe('notify', () => {
    test('stores the row and its delivery job when the transaction commits', async () => {
      const { token } = await newAccount();
      const dedupeKey = `e2e:${randomUUID()}`;

      const created = await notifyInTransaction(accountIdOf(token), dedupeKey);

      assert.ok(created);
      assert.deepEqual(await rowsWithKey(dedupeKey), [{ id: created.id }]);
      assert.equal((await deliveryJobsOf(created.id)).length, 1);
    });

    // notifications.md, rule 1; job queue, rule 1.
    test('leaves neither the row nor its job when the transaction rolls back', async () => {
      const { token } = await newAccount();
      const dedupeKey = `e2e:${randomUUID()}`;

      const created = await notifyInTransaction(accountIdOf(token), dedupeKey, false);

      assert.ok(created, 'notify returned nothing inside the transaction');
      assert.deepEqual(await rowsWithKey(dedupeKey), []);
      assert.deepEqual(await deliveryJobsOf(created.id), []);
    });

    test('a repeated dedupe key stores one row and one job, without an error', async () => {
      const { token } = await newAccount();
      const accountId = accountIdOf(token);
      const dedupeKey = `e2e:${randomUUID()}`;
      const first = await notifyInTransaction(accountId, dedupeKey);

      const second = await notifyInTransaction(accountId, dedupeKey);

      assert.ok(first);
      assert.equal(second, undefined);
      assert.deepEqual(await rowsWithKey(dedupeKey), [{ id: first.id }]);
      assert.equal((await deliveryJobsOf(first.id)).length, 1);
    });

    test('the API delivers the job: without push the row ends up skipped', async () => {
      const { token } = await newAccount();
      const id = await notified(accountIdOf(token));
      const until = Date.now() + 15_000;

      let status: string | undefined;
      while (status !== 'skipped' && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const { rows } = await withDatabase((client) =>
          client.query<{ push_status: string }>('SELECT push_status FROM notifications WHERE id = $1', [id]),
        );
        status = rows[0]?.push_status;
      }

      assert.equal(status, 'skipped');
    });
  });

  describe('GET /api/v1/me/notifications', () => {
    test('lists only the caller’s own notifications, newest first', async () => {
      const { token } = await newAccount();
      const other = await newAccount();
      const older = await notified(accountIdOf(token));
      const newer = await notified(accountIdOf(token));
      const othersId = await notified(accountIdOf(other.token));

      const res = await call('GET', '/api/v1/me/notifications', { token });

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(
        res.body.items.map(({ id }: { id: string }) => id),
        [newer, older],
      );
      assert.ok(!res.body.items.some(({ id }: { id: string }) => id === othersId));
      assert.deepEqual(Object.keys(res.body.items[0]).sort(), ['createdAt', 'id', 'payload', 'readAt', 'type']);
      assert.equal(res.body.items[0].type, 'report_received');
      assert.deepEqual(res.body.items[0].payload, {});
      assert.equal(res.body.items[0].readAt, null);
      assert.deepEqual(res.body.page, { limit: 20, offset: 0, hasMore: false });
    });

    test('pages with limit and offset', async () => {
      const { token } = await newAccount();
      const older = await notified(accountIdOf(token));
      const newer = await notified(accountIdOf(token));

      const first = await call('GET', '/api/v1/me/notifications?limit=1', { token });
      const second = await call('GET', '/api/v1/me/notifications?limit=1&offset=1', { token });

      assert.deepEqual(
        first.body.items.map(({ id }: { id: string }) => id),
        [newer],
      );
      assert.equal(first.body.page.hasMore, true);
      assert.deepEqual(
        second.body.items.map(({ id }: { id: string }) => id),
        [older],
      );
      assert.equal(second.body.page.hasMore, false);
    });

    test('rejects a guest token with 401', async () => {
      assertRejected(await call('GET', '/api/v1/me/notifications', { token: tokens.guest }), 401, 'UNAUTHENTICATED');
    });

    test('rejects a limit above 20 with 400', async () => {
      assertInvalid(await call('GET', '/api/v1/me/notifications?limit=21', { token: tokens.user }), 'query', 'limit');
    });
  });

  describe('POST /api/v1/notifications/{id}/read', () => {
    test('marks the caller’s own notification read, and reading it again keeps the first time', async () => {
      const { token } = await newAccount();
      const id = await notified(accountIdOf(token));

      const read = await call('POST', `/api/v1/notifications/${id}/read`, { token });
      const again = await call('POST', `/api/v1/notifications/${id}/read`, { token });

      assert.equal(read.status, 200, JSON.stringify(read.body));
      assert.equal(read.body.id, id);
      assert.ok(read.body.readAt, 'readAt is not set');
      assert.equal(again.status, 200, JSON.stringify(again.body));
      assert.equal(again.body.readAt, read.body.readAt);
      const list = await call('GET', '/api/v1/me/notifications', { token });
      assert.equal(list.body.items[0].readAt, read.body.readAt);
    });

    // SEC-001: someone else's notification is a 404, as one that does not exist, and stays unread.
    test('cannot mark someone else’s notification read', async () => {
      const owner = await newAccount();
      const { token } = await newAccount();
      const id = await notified(accountIdOf(owner.token));

      const res = await call('POST', `/api/v1/notifications/${id}/read`, { token });

      assertRejected(res, 404, 'NOT_FOUND');
      const list = await call('GET', '/api/v1/me/notifications', { token: owner.token });
      assert.equal(list.body.items[0].readAt, null);
    });

    test('rejects a guest token with 401', async () => {
      const { token } = await newAccount();
      const id = await notified(accountIdOf(token));

      assertRejected(
        await call('POST', `/api/v1/notifications/${id}/read`, { token: tokens.guest }),
        401,
        'UNAUTHENTICATED',
      );
    });

    test('rejects an id that is not a UUID with 400', async () => {
      assertInvalid(
        await call('POST', '/api/v1/notifications/not-a-uuid/read', { token: tokens.user }),
        'params',
        'id',
      );
    });
  });
});

// SAFE-003: the first sender of notifications (issue #372).
describe('Report received notifications', () => {
  const inboxOf = async (token: string) => {
    const res = await call('GET', '/api/v1/me/notifications', { token });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.items as { type: string; payload: unknown; readAt: string | null }[];
  };

  test('tells the reporter of a user that the report was received, and no one else', async () => {
    const reporter = await newAccount();
    const target = await newProfile();

    const res = await call('POST', '/api/v1/reports', {
      token: reporter.token,
      body: { username: target.username, reason: 'no_show' },
    });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    const inbox = await inboxOf(reporter.token);
    assert.deepEqual(
      inbox.map(({ type, payload, readAt }) => ({ type, payload, readAt })),
      [{ type: 'report_received', payload: {}, readAt: null }],
    );
    assert.deepEqual(await inboxOf(target.token), []);
  });

  test('tells the reporter of a listing that the report was received', async () => {
    const author = await newProfile();
    const listing = await call('POST', '/api/v1/listings', { token: author.token, body: newListing });
    const reporter = await newAccount();

    const res = await call('POST', '/api/v1/reports', {
      token: reporter.token,
      body: { listingId: listing.body.id, reason: 'offensive_messages' },
    });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    assert.deepEqual(
      (await inboxOf(reporter.token)).map(({ type }) => type),
      ['report_received'],
    );
    assert.deepEqual(await inboxOf(author.token), []);
  });

  test('tells the reporter of each report, also of a second one that joins the same case', async () => {
    const reporter = await newAccount();
    const target = await newProfile();

    for (const comment of ['Did not come.', 'Did not answer either.']) {
      const res = await call('POST', '/api/v1/reports', {
        token: reporter.token,
        body: { username: target.username, reason: 'no_show', comment },
      });
      assert.equal(res.status, 204, JSON.stringify(res.body));
    }

    assert.deepEqual(
      (await inboxOf(reporter.token)).map(({ type }) => type),
      ['report_received', 'report_received'],
    );
  });

  test('tells the reporter also when the reported user is banned, so the ban stays private', async () => {
    const target = await newProfile();
    await reportAndResolve(target.username, target.accountId, 'ban');
    const reporter = await newAccount();

    const res = await call('POST', '/api/v1/reports', {
      token: reporter.token,
      body: { username: target.username, reason: 'other' },
    });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    assert.deepEqual(
      (await inboxOf(reporter.token)).map(({ type }) => type),
      ['report_received'],
    );
  });

  test('tells no one about a report that is rejected', async () => {
    const reporter = await newProfile();

    const res = await call('POST', '/api/v1/reports', {
      token: reporter.token,
      body: { username: reporter.username, reason: 'other' },
    });

    assertRejected(res, 422, 'CANNOT_REPORT_SELF');
    assert.deepEqual(await inboxOf(reporter.token), []);
  });
});

// A device's Expo push token, tied to the session that registered it (data model, issue #372). The API never returns it.
describe('Push tokens', () => {
  const path = '/api/v1/me/push-token';

  /** A token in the Expo format, of its own for every test. */
  const newPushToken = () => `ExponentPushToken[${randomUUID()}]`;

  const sessionIdOf = (token: string): string =>
    JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).sid;

  const devicesWithToken = (pushToken: string) =>
    withDatabase(async (client) => {
      const { rows } = await client.query<{ account_id: string; refresh_token_id: string; platform: string }>(
        'SELECT account_id, refresh_token_id, platform FROM device_tokens WHERE push_token = $1',
        [pushToken],
      );
      return rows;
    });

  const devicesOfSession = (sessionId: string) =>
    withDatabase(async (client) => {
      const { rows } = await client.query<{ push_token: string }>(
        'SELECT push_token FROM device_tokens WHERE refresh_token_id = $1',
        [sessionId],
      );
      return rows.map(({ push_token }) => push_token);
    });

  async function register(token: string, pushToken: string, platform = 'android'): Promise<Response> {
    const res = await call('PUT', path, { token, body: { pushToken, platform } });
    assert.equal(res.status, 204, JSON.stringify(res.body));
    return res;
  }

  test('ties the token to the caller’s account, session and platform', async () => {
    const { token } = await newAccount();
    const pushToken = newPushToken();

    await register(token, pushToken);

    assert.deepEqual(await devicesWithToken(pushToken), [
      { account_id: accountIdOf(token), refresh_token_id: sessionIdOf(token), platform: 'android' },
    ]);
  });

  test('returns the token in no response', async () => {
    const { token } = await newAccount();
    const pushToken = newPushToken();

    const responses = [
      await register(token, pushToken),
      await register(token, pushToken),
      await call('GET', '/api/v1/me/notifications', { token }),
      await call('GET', '/api/v1/me/profile', { token }),
      await call('DELETE', path, { token }),
    ];

    for (const res of responses) {
      assert.equal(JSON.stringify(res.body ?? null).includes(pushToken), false, JSON.stringify(res.body));
    }
  });

  test('moves a token registered again to the new account and session, without an error', async () => {
    const first = await newAccount();
    const second = await newAccount();
    const pushToken = newPushToken();
    await register(first.token, pushToken);

    await register(second.token, pushToken);

    assert.deepEqual(await devicesWithToken(pushToken), [
      { account_id: accountIdOf(second.token), refresh_token_id: sessionIdOf(second.token), platform: 'android' },
    ]);
  });

  test('keeps one token per session: a new token replaces the old one', async () => {
    const { token } = await newAccount();
    const old = newPushToken();
    const current = newPushToken();
    await register(token, old);

    await register(token, current, 'ios');

    assert.deepEqual(await devicesOfSession(sessionIdOf(token)), [current]);
  });

  test('DELETE removes the token of the session, and answers 204 again when there is none', async () => {
    const { token } = await newAccount();
    const pushToken = newPushToken();
    await register(token, pushToken);

    const removed = await call('DELETE', path, { token });
    const again = await call('DELETE', path, { token });

    assert.equal(removed.status, 204, JSON.stringify(removed.body));
    assert.equal(again.status, 204, JSON.stringify(again.body));
    assert.deepEqual(await devicesWithToken(pushToken), []);
  });

  test('sign-out removes the token of the session and keeps the other sessions’ tokens', async () => {
    const { subject, token } = await newAccount();
    const other = await newSession(subject);
    const pushToken = newPushToken();
    const otherPushToken = newPushToken();
    await register(token, pushToken);
    await register(other.accessToken, otherPushToken);

    const res = await call('POST', '/api/v1/auth/sign-out', { token });

    assert.equal(res.status, 204, JSON.stringify(res.body));
    assert.deepEqual(await devicesWithToken(pushToken), []);
    assert.equal((await devicesWithToken(otherPushToken)).length, 1);
  });

  test('a ban removes the tokens of every session of the account', async () => {
    const reported = await newProfile();
    const pushToken = newPushToken();
    await register(reported.token, pushToken);

    await reportAndResolve(reported.username, reported.accountId, 'ban');

    assert.deepEqual(await devicesWithToken(pushToken), []);
  });

  test('a refresh with a wrong secret ends the session and removes its token', async () => {
    const { subject } = await newAccount();
    const session = await newSession(subject);
    const pushToken = newPushToken();
    await register(session.accessToken, pushToken);
    const sessionId = session.refreshToken.split('.')[0];

    const res = await call('POST', '/api/v1/auth/refresh', {
      body: { refreshToken: `${sessionId}.${randomBytes(32).toString('base64url')}` },
    });

    assertRejected(res, 401, 'INVALID_REFRESH_TOKEN');
    assert.deepEqual(await devicesWithToken(pushToken), []);
  });

  test('rejects a token that is not an Expo push token with 400', async () => {
    const { token } = await newAccount();

    assertInvalid(
      await call('PUT', path, { token, body: { pushToken: 'fcm-token', platform: 'android' } }),
      'body',
      'pushToken',
    );
  });

  test('rejects a guest token with 401', async () => {
    const body = { pushToken: newPushToken(), platform: 'android' };

    assertRejected(await call('PUT', path, { token: tokens.guest, body }), 401, 'UNAUTHENTICATED');
    assertRejected(await call('DELETE', path, { token: tokens.guest }), 401, 'UNAUTHENTICATED');
  });
});

// SEC-003: the columns hold ciphertext; the API never shows them, so the test reads them directly.
describe('Personal data at rest', () => {
  test('stores the date of birth only encrypted, and no phone number for a Google account', async () => {
    const { token } = await newAccount();

    const account = await withDatabase(
      async (client) =>
        (
          await client.query('SELECT contact_identifier, contact_hash, date_of_birth FROM accounts WHERE id = $1', [
            accountIdOf(token),
          ])
        ).rows[0],
    );

    assert.equal(account.contact_identifier, null);
    assert.equal(account.contact_hash, null);
    assert.ok(Buffer.isBuffer(account.date_of_birth));
    // newAccount registers with this date of birth.
    assert.equal(account.date_of_birth.includes('2000-05-17'), false);
  });
});

// The locks and conditional updates in the repositories, which the unit tests mock and one request at a time never reaches.
describe('Parallel requests', () => {
  const parallel = <T>(times: number, request: () => Promise<T>) => Promise.all(Array.from({ length: times }, request));

  // On one database connection the requests would run one after another and never race.
  const openConnections = () => parallel(10, () => call('GET', '/api/v1/categories', { token: tokens.guest }));

  // SEC-005, REL-08. A request that loses the race gets 409; one that reads the session after another rotated it is
  // a retry within 60 s. How many get 200 depends on timing, but the session stays and exactly one token works.
  test('keep the session and one working refresh token when one token is sent 5 times at once', async () => {
    const session = await newSession(subjects.user);
    await openConnections();

    const responses = await parallel(5, () =>
      call('POST', '/api/v1/auth/refresh', { body: { refreshToken: session.refreshToken } }),
    );

    const bodies = JSON.stringify(responses.map((res) => [res.status, res.body]));
    assert.ok(
      responses.every((res) => res.status === 200 || res.status === 409),
      bodies,
    );
    const issued = responses.filter((res) => res.status === 200).map((res) => res.body.refreshToken as string);
    assert.ok(issued.length >= 1, bodies);
    const [sessionId] = session.refreshToken.split('.');
    const { rows } = await withDatabase((client) =>
      client.query('SELECT token_hash, revoked_at FROM refresh_tokens WHERE id = $1', [sessionId]),
    );
    const stored = issued.filter(
      (token) => createHash('sha256').update(token.split('.')[1]).digest('base64url') === rows[0].token_hash,
    );
    assert.equal(rows[0].revoked_at, null, bodies);
    assert.equal(stored.length, 1, bodies);
  });

  // Whether the requests actually collide is up to timing; the repository's unit tests cover the collision itself.
  test('create one account when one Google account registers 5 times at once', async () => {
    const idToken = await googleIdToken(newGoogleSubject());
    await openConnections();

    const responses = await parallel(5, () => call('POST', '/api/v1/auth/google/register', { body: { idToken } }));

    assert.ok(
      responses.every((res) => res.status === 200),
      JSON.stringify(responses.map((res) => res.body)),
    );
    const [first, ...others] = responses;
    const complete = (token: string) =>
      call('POST', '/api/v1/auth/complete-registration', { token, body: { dateOfBirth: '2000-05-17' } });
    assert.equal((await complete(first?.body.accessToken)).status, 200);
    for (const res of others) {
      assertRejected(await complete(res.body.accessToken), 409, 'CONFLICT');
    }
  });
});

// CMP-03, FR-008, FR-015: the import is a process of its own, connected as nearby_import (database-access.md).
// It reads ArtWizard, Karabas and Nominatim from a local server with the responses saved on 2026-11-03, never the
// sites.
describe('Event import', () => {
  const ARTWIZARD_TEST_KEY = 'e2e-artwizard-key';
  let providerSite: Server;
  let providerSiteUrl = '';
  /** A Karabas event the local site leaves out of every page while set, as if Karabas had removed it. */
  let karabasRemoved: string | undefined;

  before(async () => {
    const saved = (file: string) => readFileSync(path.resolve('tests/unit/fixtures/providers', file));
    const pages = new Map([
      ['/concerts/', 'karabas/kyiv-concerts.html'],
      ['/clubs/', 'karabas/kyiv-clubs.html'],
      ['/sport/', 'karabas/kyiv-sport.html'],
      ['/search', 'nominatim/search.json'],
    ]);
    // The ArtWizard API's pages 1 and 2 of the saved run, as if they were all: 40 of its 74 Kyiv events.
    const artWizardPage = (page: string) => {
      const body = JSON.parse(saved(`artwizard/events-page-${page}.json`).toString()) as Record<string, unknown>;
      return JSON.stringify({ ...body, total: 40, total_pages: 2 });
    };
    const eventBlocks = /<script type="application\/ld\+json">[\s\S]*?<\/script>/g;
    // The site's own JSON-LD blocks stay: a page without any counts as a failed section (REL-14).
    const noEvents = saved('karabas/kyiv-sport-2026-11-07-no-events.html').toString();
    const withoutEvent = (html: string, slug: string) =>
      html.replace(eventBlocks, (block) => (block.includes(`/${slug}/"`) ? '' : block));
    providerSite = createHttpServer((req, res) => {
      const { pathname, searchParams } = new URL(req.url ?? '/', 'http://localhost');
      if (pathname === '/events') {
        const page = searchParams.get('page') ?? '';
        if (searchParams.get('apiKey') !== ARTWIZARD_TEST_KEY) {
          res.writeHead(401).end();
        } else {
          res
            .writeHead(['1', '2'].includes(page) ? 200 : 404)
            .end(['1', '2'].includes(page) ? artWizardPage(page) : '');
        }
        return;
      }
      // Only the first page of three Karabas sections was saved on 3 November. The others, and the next page of a
      // saved one, answer with a saved page without its events, which has no "load more" link either: the end of
      // the section, so a Karabas run reads its full list.
      if (KARABAS_SECTIONS.some(({ path }) => path === pathname)) {
        const file = searchParams.has('page') ? undefined : pages.get(pathname);
        const html = file ? saved(file).toString() : noEvents;
        res.writeHead(200).end(karabasRemoved ? withoutEvent(html, karabasRemoved) : html);
        return;
      }
      const file = pages.get(pathname);
      res.writeHead(file ? 200 : 404).end(file ? saved(file) : '');
    });
    await new Promise<void>((resolve) => providerSite.listen(0, resolve));
    const { port } = providerSite.address() as AddressInfo;
    providerSiteUrl = `http://localhost:${port}`;
  });

  after(() => new Promise<void>((resolve) => providerSite.close(() => resolve())));

  /** Starts the import process from a folder without .env, with no key file and no MAIN_DATABASE_URL. */
  function startImport(args: string[], { artWizardApiKey = ARTWIZARD_TEST_KEY } = {}) {
    const cwd = mkdtempSync(path.join(tmpdir(), 'nearby-import-'));
    const child = spawn(process.execPath, [path.resolve('dist/import/main.js'), ...args], {
      cwd,
      env: {
        PATH: process.env.PATH,
        IMPORT_DATABASE_URL: runDatabaseUrl('IMPORT_DATABASE_URL'),
        ARTWIZARD_API_URL: providerSiteUrl,
        ARTWIZARD_API_KEY: artWizardApiKey,
        KARABAS_BASE_URL: providerSiteUrl,
        NOMINATIM_BASE_URL: providerSiteUrl,
        IMPORT_REQUEST_INTERVAL_MS: '0',
        IMPORT_NOW: '2026-11-03T10:00:00Z',
      },
    });
    child.on('close', () => rmSync(cwd, { recursive: true, force: true }));
    return child;
  }

  /**
   * One import run of every provider. Asynchronous, so the local provider site in this process can answer it. With
   * `--force`, since the tests run the providers many times a day. Returns what the process printed.
   */
  async function runImport({ artWizardApiKey = ARTWIZARD_TEST_KEY, exitCode = 0 } = {}) {
    const child = startImport(['--once', '--force'], { artWizardApiKey });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const status = await new Promise<number | null>((resolve) => child.on('close', resolve));
    assert.equal(status, exitCode, output);
    return output;
  }

  const importedEvents = (provider: string) =>
    withDatabase(async (client) => {
      const { rows } = await client.query<{
        organization_id: string | null;
        status: string;
        venue_source: string;
        source_url: string | null;
      }>(
        `SELECT e.organization_id, e.status, v.source AS venue_source, e.source_url
           FROM events e JOIN venues v ON v.id = e.venue_id
          WHERE e.source = 'import' AND e.provider = $1`,
        [provider],
      );
      return rows;
    });

  test('takes the usable events of both providers into events and venues, and keeps the runs and the skipped ones', async () => {
    const runsBefore = await withDatabase(async (client) =>
      (await client.query('SELECT id FROM import_runs')).rows.map(({ id }: { id: string }) => id),
    );

    await runImport();

    // ArtWizard: 38 of the 40 events, 8 of them exhibition runs without opening hours; a play has no start time in
    // the window, and one event has no occurrence in it. Karabas: 20 concerts, the 7 MusicEvent records of the 12 club events that are not
    // concerts too (the other 5 are plain Event: talks, board games, wine), and 1 sport event.
    const artWizard = await importedEvents('artwizard');
    const karabas = await importedEvents('karabas');
    assert.equal(artWizard.length, 38);
    assert.equal(karabas.length, 28);
    for (const event of [...artWizard, ...karabas]) {
      assert.equal(event.organization_id, null);
      assert.equal(event.status, 'published');
      assert.equal(event.venue_source, 'import');
      assert.match(event.source_url ?? '', /^https:\/\/(artwizard\.io|kyiv\.karabas\.com)\//);
    }
    const { rows: runs } = await withDatabase((client) =>
      client.query<{ provider: string; status: string; finished: boolean; complete: boolean; skipped: number }>(
        `SELECT r.provider, r.status, r.finished_at IS NOT NULL AS finished, r.complete, count(s.id)::int AS skipped
           FROM import_runs r LEFT JOIN skipped_records s ON s.import_run_id = r.id
          WHERE NOT (r.id = ANY($1::uuid[]))
          GROUP BY r.id
          ORDER BY r.provider`,
        [runsBefore],
      ),
    );
    assert.deepEqual(runs, [
      { provider: 'artwizard', status: 'succeeded', finished: true, complete: true, skipped: 2 },
      { provider: 'karabas', status: 'succeeded', finished: true, complete: true, skipped: 5 },
    ]);
  });

  test('changes nothing when the providers have not changed', async () => {
    await runImport();
    const first = (await importedEvents('karabas')).length;

    await runImport();

    assert.equal((await importedEvents('karabas')).length, first);
    assert.equal(first, 28);
    // The ArtWizard slugs are the external ids, so a second run updates its events instead of adding them again.
    assert.equal((await importedEvents('artwizard')).length, 38);
  });

  const eventStatus = async (provider: string, externalId: string) =>
    withDatabase(async (client) => {
      const { rows } = await client.query<{ id: string; status: string }>(
        'SELECT id, status FROM events WHERE provider = $1 AND external_id = $2',
        [provider, externalId],
      );
      return rows[0];
    });

  test('cancels a Karabas event gone from its full list, and publishes it again when it comes back', async () => {
    await runImport();
    const before = await eventStatus('karabas', 'lama-15');
    assert.equal(before?.status, 'published');

    karabasRemoved = 'lama-15';
    let output: string;
    try {
      output = await runImport();
    } finally {
      karabasRemoved = undefined;
    }

    assert.match(output, /karabas: fetched 32, .*cancelled 1, skipped 5; the full list/);
    assert.equal((await eventStatus('karabas', 'lama-15'))?.status, 'cancelled');
    const shown = await call('GET', `/api/v1/events/${before?.id}`, { token: tokens.guest });
    assert.equal(shown.status, 200);
    assert.equal(shown.body.status, 'cancelled');
    const listed = (await importedEvents('karabas')).filter((event) => event.status === 'published');
    assert.equal(listed.length, 27);

    const back = await runImport();

    assert.match(back, /karabas: fetched 33, .*\(republished 1\), unchanged 27, cancelled 0/);
    assert.equal((await eventStatus('karabas', 'lama-15'))?.status, 'published');
  });

  test('cancels nothing when an ArtWizard run fails', async () => {
    await runImport();
    const published = async () =>
      (await importedEvents('artwizard')).filter((event) => event.status === 'published').length;
    const before = await published();

    await runImport({ artWizardApiKey: 'wrong-key', exitCode: 1 });

    assert.equal(await published(), before);
    assert.equal(before, 38);
  });

  // FR-014, REL-003
  test('after a failed ArtWizard run, serves its events with the time of its last succeeded run for the notice', async () => {
    await runImport();
    const current = await call('GET', '/api/v1/events?limit=1', { token: tokens.guest });
    assert.equal(current.status, 200);
    assert.equal(current.body.lastUpdatedAt, null);
    const { rows } = await withDatabase((client) =>
      client.query<{ finished_at: Date }>(
        `SELECT finished_at FROM import_runs WHERE provider = 'artwizard' AND status = 'succeeded'
          ORDER BY started_at DESC LIMIT 1`,
      ),
    );
    const lastSucceededAt = rows[0]?.finished_at.toISOString();

    await runImport({ artWizardApiKey: 'wrong-key', exitCode: 1 });
    const events = await call('GET', '/api/v1/events?limit=20', { token: tokens.guest });

    assert.equal(events.status, 200);
    assert.ok(events.body.items.length > 0);
    assert.ok(lastSucceededAt);
    assert.equal(events.body.lastUpdatedAt, lastSucceededAt);
    // The same on another page and with a filter.
    const other = await call('GET', '/api/v1/events?limit=1&offset=3&from=2026-12-01', { token: tokens.guest });
    assert.equal(other.status, 200);
    assert.equal(other.body.lastUpdatedAt, lastSucceededAt);
  });

  test('has no route of its own for the notice: the former one is read as an event id', async () => {
    const former = 'freshness';
    assertInvalid(await call('GET', `/api/v1/events/${former}`, { token: tokens.guest }), 'params', 'id');
  });

  test('finds an ArtWizard venue saved with the city twice, as earlier runs saved it, instead of saving it again', async () => {
    await runImport();
    // As the import wrote it before: the API's address already ends with Київ, and the city was added again.
    const { rows } = await withDatabase((client) =>
      client.query<{ id: string }>(
        `UPDATE venues SET address = address || ', Київ'
          WHERE source = 'import' AND name = 'Будинок Кіно' AND address = 'вулиця Саксаганського, 6, Київ'
          RETURNING id`,
      ),
    );
    assert.equal(rows.length, 1);

    await runImport();

    const { rows: venues } = await withDatabase((client) =>
      client.query<{ id: string; address: string }>(
        `SELECT id, address FROM venues WHERE source = 'import' AND name = 'Будинок Кіно'`,
      ),
    );
    assert.deepEqual(venues, [{ id: rows[0]?.id, address: 'вулиця Саксаганського, 6, Київ, Київ' }]);
    const { rows: events } = await withDatabase((client) =>
      client.query<{ venue_id: string }>(
        `SELECT DISTINCT e.venue_id FROM events e JOIN venues v ON v.id = e.venue_id
          WHERE e.provider = 'artwizard' AND v.name = 'Будинок Кіно'`,
      ),
    );
    assert.deepEqual(events, [{ venue_id: rows[0]?.id }]);
  });

  // ADR-006, decision 7: the venue pairs of the live runs are in the unit tests; these check the database side.
  test('moves the events of a venue to an older saved one at the same address with a similar name, and keeps both rows', async () => {
    await runImport();
    // The venue as ArtWizard writes it, saved before the Karabas one, as if ArtWizard had listed it first.
    const { rows } = await withDatabase((client) =>
      client.query<{ id: string }>(
        `INSERT INTO venues (name, address, latitude, longitude, source, created_at)
         VALUES ('Pepper''s Club', 'вулиця Князів Острозьких, 8, Київ', 50.440262, 30.544271, 'import',
                 now() - interval '1 year')
         RETURNING id`,
      ),
    );
    const older = rows[0]?.id;

    await runImport();

    const { rows: venues } = await withDatabase((client) =>
      client.query<{ id: string; events: number }>(
        `SELECT v.id, (SELECT count(*)::int FROM events e WHERE e.venue_id = v.id) AS events
           FROM venues v WHERE v.source = 'import' AND v.name LIKE '%Pepper''s Club%' ORDER BY v.created_at`,
      ),
    );
    assert.equal(venues.length, 2);
    assert.equal(venues[0]?.id, older);
    assert.ok((venues[0]?.events ?? 0) > 0);
    assert.equal(venues[1]?.events, 0);
  });

  test('keeps two venues of one building apart when their names differ', async () => {
    await runImport();

    const { rows } = await withDatabase((client) =>
      client.query<{ name: string }>(
        `SELECT name FROM venues WHERE source = 'import' AND name IN ('Реверб', 'Otel’') ORDER BY name`,
      ),
    );
    assert.deepEqual(
      rows.map(({ name }) => name),
      ['Otel’', 'Реверб'],
    );
  });

  test('marks a run that never finished as failed before the next run of its provider', async () => {
    const { rows } = await withDatabase((client) =>
      client.query<{ id: string }>(
        `INSERT INTO import_runs (provider, status, started_at) VALUES ('karabas', 'running', now() - interval '1 day')
         RETURNING id`,
      ),
    );
    const leftOver = rows[0]?.id;

    await runImport();

    const { rows: after } = await withDatabase((client) =>
      client.query<{ status: string; finished: boolean }>(
        'SELECT status, finished_at IS NOT NULL AS finished FROM import_runs WHERE id = $1',
        [leftOver],
      ),
    );
    assert.deepEqual(after, [{ status: 'failed', finished: false }]);
  });

  test('without ARTWIZARD_API_KEY fails the ArtWizard run only, and still imports Karabas', async () => {
    const runsBefore = await withDatabase(async (client) =>
      (await client.query('SELECT id FROM import_runs')).rows.map(({ id }: { id: string }) => id),
    );

    // As on staging without the secret: the variable is set, but empty.
    const output = await runImport({ artWizardApiKey: '', exitCode: 1 });

    assert.match(output, /artwizard: the run failed: ARTWIZARD_API_KEY is not set/);
    const { rows: runs } = await withDatabase((client) =>
      client.query<{ provider: string; status: string }>(
        'SELECT provider, status FROM import_runs WHERE NOT (id = ANY($1::uuid[])) ORDER BY provider',
        [runsBefore],
      ),
    );
    assert.deepEqual(runs, [
      { provider: 'artwizard', status: 'failed' },
      { provider: 'karabas', status: 'succeeded' },
    ]);
    assert.equal((await importedEvents('karabas')).length, 28);
  });

  test('serves the imported events through the API, with their image and source URLs', async () => {
    await runImport();
    const { rows } = await withDatabase((client) =>
      client.query<{ id: string; image_url: string | null; source_url: string | null }>(
        `SELECT id, image_url, source_url FROM events WHERE source = 'import' AND provider IN ('artwizard', 'karabas')`,
      ),
    );

    assert.ok(rows.length > 0);
    for (const { id, image_url: imageUrl, source_url: sourceUrl } of rows) {
      const res = await call('GET', `/api/v1/events/${id}`, { token: tokens.guest });
      assert.equal(res.status, 200);
      assert.equal(res.body.source, 'import');
      assert.equal(res.body.imageUrl, imageUrl);
      assert.equal(res.body.sourceUrl, sourceUrl);
    }
    assert.ok(rows.some(({ source_url: sourceUrl }) => sourceUrl !== null));
  });

  test('says through the API which imported events have no known end', async () => {
    await runImport();
    const { rows } = await withDatabase((client) =>
      client.query<{ id: string; end_time_known: boolean; ends_with_day: boolean }>(
        `SELECT id, end_time_known, (ends_at AT TIME ZONE 'Europe/Kyiv')::time = '23:59:59.999' AS ends_with_day
           FROM events WHERE source = 'import' AND provider IN ('artwizard', 'karabas')`,
      ),
    );

    // The saved Karabas pages give the next midnight as the end of every event they list.
    assert.ok(rows.some(({ end_time_known: known }) => !known));
    for (const { id, end_time_known: known, ends_with_day: endsWithDay } of rows) {
      const res = await call('GET', `/api/v1/events/${id}`, { token: tokens.guest });
      assert.equal(res.body.endTimeKnown, known);
      // An unknown end is always stored as the end of a day: the start day's, or a run's last day's.
      assert.ok(known || endsWithDay, id);
    }
  });

  // ADR-006, decision 5
  test('serves an ArtWizard exhibition run from a default 12:00 to its last day, and says the start is a default', async () => {
    await runImport();
    const { rows } = await withDatabase((client) =>
      client.query<{ id: string; external_id: string }>(
        `SELECT id, external_id FROM events WHERE source = 'import' AND NOT start_time_known ORDER BY external_id`,
      ),
    );
    const ivaniv = rows.find((row) => row.external_id === 'ivaniv-kovcheg-prostir-svobodi-20260820');

    assert.equal(rows.length, 8);
    const res = await call('GET', `/api/v1/events/${ivaniv?.id}`, { token: tokens.guest });
    assert.equal(res.status, 200);
    assert.deepEqual(
      [Date.parse(res.body.startsAt), res.body.startTimeKnown, Date.parse(res.body.endsAt), res.body.endTimeKnown],
      [Date.parse('2026-11-03T12:00:00+02:00'), false, Date.parse('2026-11-29T23:59:59.999+02:00'), false],
    );
  });

  // A typo in a provider's mapping would otherwise only skip that genre's events, with no test failing.
  test('every category slug the providers map to is an active category after the migrations', async () => {
    const used = new Set([...ARTWIZARD_CATEGORY_SLUGS.values(), ...KARABAS_SECTIONS.map((s) => s.categorySlug)]);
    const { rows } = await withDatabase((client) =>
      client.query<{ slug: string }>('SELECT slug FROM categories WHERE is_active'),
    );
    const active = new Set(rows.map(({ slug }) => slug));

    assert.deepEqual(
      [...used].filter((slug) => !active.has(slug)),
      [],
    );
  });

  test('still imports into a category an admin renamed', async () => {
    const rename = (name: string) =>
      call('PATCH', `/api/v1/admin/categories/${concerts}`, { token: tokens.admin, body: { name } });
    assert.equal((await rename('Музика наживо')).status, 200);
    try {
      const output = await runImport();

      assert.doesNotMatch(output, /Unknown category/);
      // The five plain Event records of /clubs/ are skipped for their @type, never for the category.
      assert.match(output, /karabas: fetched 33, .*skipped 5;/);
      const { rows } = await withDatabase((client) =>
        client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM events WHERE provider = 'karabas' AND category_id = $1`,
          [concerts],
        ),
      );
      assert.equal(rows[0]?.count, 20);
    } finally {
      assert.equal((await rename('Концерти')).status, 200);
    }
  });

  test('connects as nearby_import, which may not read a table outside its grants', async () => {
    const client = new pg.Client({ connectionString: runDatabaseUrl('IMPORT_DATABASE_URL') });
    await client.connect();
    try {
      await assert.rejects(client.query('SELECT id FROM accounts LIMIT 1'), /permission denied for table accounts/);
    } finally {
      await client.end();
    }
  });
  test('refuses --force without --once, and in production, before it connects anywhere', () => {
    for (const [args, env] of [
      [['--force'], {}],
      [['--once', '--force'], { NODE_ENV: 'production' }],
    ] as const) {
      const { status, stderr } = spawnSync(process.execPath, [path.resolve('dist/import/main.js'), ...args], {
        cwd: tmpdir(),
        env: { PATH: process.env.PATH, ...env },
        encoding: 'utf8',
      });

      assert.equal(status, 2, stderr);
      assert.match(stderr, /--force is for a local run only/);
    }
  });

  // HLD I3, ADR-006 (decision 9): without --once the import runs until stopped and imports on the import.run jobs.
  describe('the long-running process', () => {
    const WAIT_MS = 30_000;
    let worker: ChildProcess;
    let workerOutput = '';
    /** Enqueues as the API would, as nearby_main. */
    let jobs: PgBossJobQueue;

    /** Polls `check` until it returns something, or fails after WAIT_MS. */
    async function eventually<T>(what: string, check: () => Promise<T | undefined> | T | undefined): Promise<T> {
      const until = Date.now() + WAIT_MS;
      for (;;) {
        const value = await check();
        if (value !== undefined) {
          return value;
        }
        assert.ok(Date.now() < until, `${what} did not happen; the import printed:\n${workerOutput}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const runIds = (provider: string) =>
      withDatabase(async (client) =>
        (await client.query<{ id: string }>('SELECT id FROM import_runs WHERE provider = $1', [provider])).rows.map(
          ({ id }) => id,
        ),
      );

    before(async () => {
      // Earlier tests ran the providers minutes ago; a day earlier, they are due again. Their order stays the same.
      await withDatabase((client) => client.query(`UPDATE import_runs SET started_at = started_at - interval '1 day'`));
      await withDatabase((client) => client.query(`DELETE FROM pgboss.job WHERE name = 'import.run'`));
      worker = startImport([]);
      worker.stdout?.on('data', (chunk: Buffer) => (workerOutput += chunk.toString()));
      worker.stderr?.on('data', (chunk: Buffer) => (workerOutput += chunk.toString()));
      jobs = new PgBossJobQueue(runDatabaseUrl('MAIN_DATABASE_URL'));
      jobs.onApplicationBootstrap();
      await jobs.whenStarted();
    });

    after(async () => {
      await jobs?.onModuleDestroy();
      if (worker && worker.exitCode === null) {
        worker.kill('SIGTERM');
        await new Promise((resolve) => worker.once('close', resolve));
      }
      await withDatabase(async (client) => {
        await client.query(`DELETE FROM pgboss.job WHERE name = 'import.run'`);
        await client.query(`DELETE FROM pgboss.schedule WHERE name = 'import.run'`);
      });
    });

    test('schedules every provider daily at 02:00 UTC, without retries, as nearby_import', async () => {
      const schedules = await eventually('Storing the schedules', () =>
        withDatabase(async (client) => {
          const { rows } = await client.query<{ key: string; cron: string; data: unknown }>(
            `SELECT key, cron, data FROM pgboss.schedule WHERE name = 'import.run' ORDER BY key`,
          );
          return rows.length === 2 ? rows : undefined;
        }),
      );

      assert.deepEqual(schedules, [
        { key: 'artwizard', cron: '0 2 * * *', data: { providerId: 'artwizard' } },
        { key: 'karabas', cron: '0 2 * * *', data: { providerId: 'karabas' } },
      ]);
      const { rows } = await withDatabase((client) =>
        client.query(`SELECT retry_limit FROM pgboss.queue WHERE name = 'import.run'`),
      );
      assert.deepEqual(rows, [{ retry_limit: 0 }]);
    });

    test('an import.run job runs its provider only, and a second one within 20 hours starts no run', async () => {
      const karabasBefore = await runIds('karabas');
      const artWizardBefore = await runIds('artwizard');

      await jobs.enqueue('import.run', { providerId: 'karabas' });
      const [run] = await eventually('The Karabas run', () =>
        withDatabase(async (client) => {
          const { rows } = await client.query<{ id: string; status: string }>(
            `SELECT id, status FROM import_runs
              WHERE provider = 'karabas' AND status <> 'running' AND NOT (id = ANY($1::uuid[]))`,
            [karabasBefore],
          );
          return rows.length > 0 ? rows : undefined;
        }),
      );
      assert.equal(run?.status, 'succeeded', workerOutput);

      await jobs.enqueue('import.run', { providerId: 'karabas' });
      await eventually(
        'Skipping the second Karabas run',
        () => /karabas: not started: the last run started at/.test(workerOutput) || undefined,
      );

      assert.deepEqual((await runIds('karabas')).length, karabasBefore.length + 1);
      assert.deepEqual(await runIds('artwizard'), artWizardBefore);
    });

    test('exits normally on SIGTERM', async () => {
      worker.kill('SIGTERM');
      const [code] = (await new Promise((resolve) => worker.once('exit', (...args) => resolve(args)))) as [number];

      assert.equal(code, 0, workerOutput);
    });
  });
});

// SEC-002, SEC-004: last, so the log holds what every test above did.
describe('Server log', () => {
  test('contains no access token', () => {
    const secrets = Object.values(tokens);

    for (const secret of secrets) {
      assert.equal(serverOutput.includes(secret), false, `the log contains ${secret.slice(0, 12)}…`);
    }
  });
});
