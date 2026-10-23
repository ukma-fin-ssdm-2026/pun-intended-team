// Written with the help of Claude
// Integration tests of the database constraints: the indexes and checks of the database_invariants migration,
// the failed sign-in checks of accounts and the unique (profile_id, app) of linked_accounts. They write to the
// database directly, since the services check the same rules before a query and no HTTP request reaches the constraint.
// Each test runs in a transaction that is rolled back, so nothing stays in the database.
// Run with `npm run test:e2e`; the database must have all migrations applied.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

const ACTIVE_STATUSES = ['in_pool', 'paired', 'paused'] as const;

let pool: pg.Pool;

/** Runs `body` in a transaction that is always rolled back. */
async function inTransaction(body: (db: pg.PoolClient) => Promise<void>): Promise<void> {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await body(db);
  } finally {
    await db.query('ROLLBACK');
    db.release();
  }
}

/** Expects `query` to fail on the constraint or unique index `name`. */
async function assertViolates(query: Promise<unknown>, code: string, name: string): Promise<void> {
  await assert.rejects(query, (error: pg.DatabaseError) => {
    assert.equal(error.code, code, error.message);
    assert.equal(error.constraint, name, error.message);
    return true;
  });
}

async function insertId(db: pg.PoolClient, sql: string, values: unknown[]): Promise<string> {
  const {
    rows: [row],
  } = await db.query<{ id: string }>(`${sql} RETURNING id`, values);
  assert.ok(row);
  return row.id;
}

function anAccount(db: pg.PoolClient): Promise<string> {
  return insertId(db, 'INSERT INTO accounts (contact_identifier, contact_hash) VALUES ($1, $2)', [
    randomBytes(16),
    randomBytes(32),
  ]);
}

async function aProfile(db: pg.PoolClient, username = `user-${randomUUID()}`): Promise<string> {
  const accountId = await anAccount(db);
  await db.query(
    `INSERT INTO profiles (account_id, username, display_name, communication_format) VALUES ($1, $2, 'Test', 'friends')`,
    [accountId, username],
  );
  return accountId;
}

function aLinkedAccount(db: pg.PoolClient, profileId: string, app: string): Promise<unknown> {
  return db.query('INSERT INTO linked_accounts (profile_id, app, username) VALUES ($1, $2, $3)', [
    profileId,
    app,
    randomBytes(16),
  ]);
}

function aCategory(db: pg.PoolClient): Promise<string> {
  return insertId(db, 'INSERT INTO categories (name) VALUES ($1)', [`DB test ${randomUUID()}`]);
}

async function aSession(db: pg.PoolClient): Promise<string> {
  const categoryId = await aCategory(db);
  const venueId = await insertId(
    db,
    `INSERT INTO venues (name, address, latitude, longitude, source) VALUES ('Hall', 'Khreshchatyk 1', 50.45, 30.52, 'import')`,
    [],
  );
  const eventId = await insertId(
    db,
    `INSERT INTO events (category_id, venue_id, source, title, description, starts_at, ends_at)
     VALUES ($1, $2, 'import', 'Concert', 'An evening concert.', '2026-11-20T19:00:00+02:00', '2026-11-20T21:00:00+02:00')`,
    [categoryId, venueId],
  );
  return insertId(db, `INSERT INTO event_sessions (event_id, starts_at) VALUES ($1, '2026-11-20T19:00:00+02:00')`, [
    eventId,
  ]);
}

function anApplication(db: pg.PoolClient, userId: string, sessionId: string, status = 'in_pool'): Promise<string> {
  return insertId(
    db,
    `INSERT INTO applications (user_id, session_id, desired_company, open_to_extend, status)
     VALUES ($1, $2, 'friends', false, $3)`,
    [userId, sessionId, status],
  );
}

async function aListing(db: pg.PoolClient): Promise<string> {
  const authorId = await anAccount(db);
  const categoryId = await aCategory(db);
  return insertId(
    db,
    `INSERT INTO listings (author_id, category_id, title, description, date)
     VALUES ($1, $2, 'Looking for company', 'Anyone for the concert?', '2026-11-20')`,
    [authorId, categoryId],
  );
}

function aReportCase(
  db: pg.PoolClient,
  target: { accountId?: string; listingId?: string },
  { status = 'open', targetType = target.listingId ? 'listing' : 'account' } = {},
): Promise<string> {
  return insertId(
    db,
    `INSERT INTO report_cases (target_type, target_account_id, target_listing_id, status) VALUES ($1, $2, $3, $4)`,
    [targetType, target.accountId ?? null, target.listingId ?? null, status],
  );
}

before(() => {
  // Local settings, as in src/api/common/config.ts; CI sets DATABASE_URL in the environment.
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is not set: see .env.example');
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
});

after(async () => {
  await pool?.end();
});

describe('profiles_username_lower_key', () => {
  test('rejects a username that differs from another only in case', () =>
    inTransaction(async (db) => {
      const suffix = randomUUID();
      await aProfile(db, `Alice-${suffix}`);

      const insert = aProfile(db, `alice-${suffix}`);

      await assertViolates(insert, UNIQUE_VIOLATION, 'profiles_username_lower_key');
    }));

  test('accepts different usernames', () =>
    inTransaction(async (db) => {
      const suffix = randomUUID();
      await aProfile(db, `Alice-${suffix}`);

      await aProfile(db, `Bob-${suffix}`);
    }));
});

describe('accounts_active_has_date_of_birth_check', () => {
  test('rejects an active account without a date of birth', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);

      const update = db.query(`UPDATE accounts SET status = 'active' WHERE id = $1`, [accountId]);

      await assertViolates(update, CHECK_VIOLATION, 'accounts_active_has_date_of_birth_check');
    }));

  test('accepts an active account with a date of birth', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);

      await db.query(`UPDATE accounts SET status = 'active', date_of_birth = $2 WHERE id = $1`, [
        accountId,
        randomBytes(16),
      ]);
    }));
});

describe('accounts_failed_signins_window_check', () => {
  test('rejects failed sign-ins without the start of their window', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);

      const update = db.query('UPDATE accounts SET failed_signins = 1 WHERE id = $1', [accountId]);

      await assertViolates(update, CHECK_VIOLATION, 'accounts_failed_signins_window_check');
    }));

  test('rejects a window start without failed sign-ins', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);

      const update = db.query('UPDATE accounts SET failed_signins_since = now() WHERE id = $1', [accountId]);

      await assertViolates(update, CHECK_VIOLATION, 'accounts_failed_signins_window_check');
    }));

  test('accepts failed sign-ins with the start of their window', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);

      await db.query('UPDATE accounts SET failed_signins = 1, failed_signins_since = now() WHERE id = $1', [accountId]);
    }));
});

describe('accounts_failed_signins_not_negative_check', () => {
  test('rejects a negative number of failed sign-ins', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);

      const update = db.query('UPDATE accounts SET failed_signins = -1, failed_signins_since = now() WHERE id = $1', [
        accountId,
      ]);

      await assertViolates(update, CHECK_VIOLATION, 'accounts_failed_signins_not_negative_check');
    }));
});

describe('linked_accounts_profile_id_app_key', () => {
  test('rejects a second account in the same app for a profile', () =>
    inTransaction(async (db) => {
      const profileId = await aProfile(db);
      await aLinkedAccount(db, profileId, 'telegram');

      const insert = aLinkedAccount(db, profileId, 'telegram');

      await assertViolates(insert, UNIQUE_VIOLATION, 'linked_accounts_profile_id_app_key');
    }));

  test('accepts the same profile in another app', () =>
    inTransaction(async (db) => {
      const profileId = await aProfile(db);
      await aLinkedAccount(db, profileId, 'telegram');

      await aLinkedAccount(db, profileId, 'instagram');
    }));
});

describe('applications_user_id_session_id_active_key', () => {
  for (const status of ACTIVE_STATUSES) {
    test(`rejects a second application to the session while one is ${status}`, () =>
      inTransaction(async (db) => {
        const userId = await anAccount(db);
        const sessionId = await aSession(db);
        await anApplication(db, userId, sessionId, status);

        const insert = anApplication(db, userId, sessionId);

        await assertViolates(insert, UNIQUE_VIOLATION, 'applications_user_id_session_id_active_key');
      }));
  }

  test('accepts a new application after the earlier one was removed', () =>
    inTransaction(async (db) => {
      const userId = await anAccount(db);
      const sessionId = await aSession(db);
      const earlier = await anApplication(db, userId, sessionId);
      await db.query(`UPDATE applications SET status = 'removed' WHERE id = $1`, [earlier]);

      await anApplication(db, userId, sessionId);
    }));
});

describe('report_cases_open_target_listing_key', () => {
  test('rejects a second open case about the same listing', () =>
    inTransaction(async (db) => {
      const listingId = await aListing(db);
      await aReportCase(db, { listingId });

      const insert = aReportCase(db, { listingId });

      await assertViolates(insert, UNIQUE_VIOLATION, 'report_cases_open_target_listing_key');
    }));

  test('accepts an open case about a listing whose earlier case is resolved', () =>
    inTransaction(async (db) => {
      const listingId = await aListing(db);
      await aReportCase(db, { listingId }, { status: 'resolved' });

      await aReportCase(db, { listingId });
    }));
});

describe('report_cases_open_target_account_key', () => {
  test('rejects a second open case about the same account', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);
      await aReportCase(db, { accountId });

      const insert = aReportCase(db, { accountId });

      await assertViolates(insert, UNIQUE_VIOLATION, 'report_cases_open_target_account_key');
    }));

  test('accepts an open case about an account whose earlier case is resolved', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);
      await aReportCase(db, { accountId }, { status: 'resolved' });

      await aReportCase(db, { accountId });
    }));
});

describe('report_cases_one_target_check', () => {
  test('rejects a case without a target', () =>
    inTransaction(async (db) => {
      const insert = aReportCase(db, {}, { targetType: 'account' });

      await assertViolates(insert, CHECK_VIOLATION, 'report_cases_one_target_check');
    }));

  test('rejects a case with both an account and a listing', () =>
    inTransaction(async (db) => {
      const accountId = await anAccount(db);
      const listingId = await aListing(db);

      const insert = aReportCase(db, { accountId, listingId }, { targetType: 'listing' });

      await assertViolates(insert, CHECK_VIOLATION, 'report_cases_one_target_check');
    }));
});

describe('matches_different_applications_check', () => {
  test('rejects a match of an application with itself', () =>
    inTransaction(async (db) => {
      const applicationId = await anApplication(db, await anAccount(db), await aSession(db));

      const insert = db.query(
        `INSERT INTO matches (application_a_id, application_b_id, source, score, seed, valid_until)
         VALUES ($1, $1, 'instant', 0.5, 1, '2026-11-20T12:00:00+02:00')`,
        [applicationId],
      );

      await assertViolates(insert, CHECK_VIOLATION, 'matches_different_applications_check');
    }));
});
