// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  databasePoolConfig,
  type DatabaseTimeouts,
  isDatabaseTimeout,
  loadDatabaseTimeouts,
} from '../../dist/infra/prisma/database-timeouts.js';
import { aPostgresError, aUniqueViolation } from './fixtures/prisma-errors.ts';

const CONNECTION_STRING = 'postgresql://nearby_main:secret@localhost:5432/nearby';

const DEFAULTS: DatabaseTimeouts = {
  connectMs: 5_000,
  statementMs: 10_000,
  lockMs: 3_000,
  idleInTransactionMs: 15_000,
};

// REL-01: every database call of the API has a time limit.
describe('loadDatabaseTimeouts', () => {
  test('takes the defaults when no variable is set', () => {
    assert.deepEqual(loadDatabaseTimeouts({}), DEFAULTS);
  });

  test('takes the default for an empty variable, as .env.example leaves it', () => {
    assert.deepEqual(loadDatabaseTimeouts({ DATABASE_CONNECT_TIMEOUT_MS: '' }), DEFAULTS);
  });

  test('reads every variable', () => {
    const timeouts = loadDatabaseTimeouts({
      DATABASE_CONNECT_TIMEOUT_MS: '2000',
      DATABASE_STATEMENT_TIMEOUT_MS: '8000',
      DATABASE_LOCK_TIMEOUT_MS: '1000',
      DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS: '20000',
    });

    assert.deepEqual(timeouts, { connectMs: 2_000, statementMs: 8_000, lockMs: 1_000, idleInTransactionMs: 20_000 });
  });

  const invalidValues = ['0', '-1', 'abc', '1.5', '5s', ' 5000', '1e4', '05000'];

  for (const value of invalidValues) {
    test(`refuses to start with DATABASE_STATEMENT_TIMEOUT_MS="${value}"`, () => {
      assert.throws(() => loadDatabaseTimeouts({ DATABASE_STATEMENT_TIMEOUT_MS: value }), {
        message: `DATABASE_STATEMENT_TIMEOUT_MS must be a positive number of milliseconds, got "${value}"`,
      });
    });
  }

  for (const value of ['86400001', '99999999999999999999']) {
    test(`refuses to start with DATABASE_STATEMENT_TIMEOUT_MS="${value}", more than one day`, () => {
      assert.throws(() => loadDatabaseTimeouts({ DATABASE_STATEMENT_TIMEOUT_MS: value }), {
        message: `DATABASE_STATEMENT_TIMEOUT_MS must be at most 86400000 milliseconds (one day), got "${value}"`,
      });
    });
  }

  test('accepts one day, the largest value', () => {
    assert.equal(loadDatabaseTimeouts({ DATABASE_STATEMENT_TIMEOUT_MS: '86400000' }).statementMs, 86_400_000);
  });

  test('refuses a lock timeout above the statement timeout, which would never fire', () => {
    assert.throws(
      () => loadDatabaseTimeouts({ DATABASE_STATEMENT_TIMEOUT_MS: '2000', DATABASE_LOCK_TIMEOUT_MS: '2001' }),
      { message: /DATABASE_LOCK_TIMEOUT_MS must not exceed DATABASE_STATEMENT_TIMEOUT_MS/ },
    );
  });
});

describe('databasePoolConfig', () => {
  test('passes every time limit to pg, with the client limit 1 s after the server one', () => {
    const config = databasePoolConfig(CONNECTION_STRING, DEFAULTS);

    assert.deepEqual(config, {
      connectionString: CONNECTION_STRING,
      connectionTimeoutMillis: DEFAULTS.connectMs,
      statement_timeout: DEFAULTS.statementMs,
      lock_timeout: DEFAULTS.lockMs,
      idle_in_transaction_session_timeout: DEFAULTS.idleInTransactionMs,
      query_timeout: DEFAULTS.statementMs + 1_000,
    });
  });
});

describe('isDatabaseTimeout', () => {
  const cases: { title: string; error: unknown; expected: boolean }[] = [
    {
      title: 'a pool checkout that found no free connection',
      error: new Error('timeout exceeded when trying to connect'),
      expected: true,
    },
    {
      title: 'a new connection the server did not answer',
      error: new Error('Connection terminated due to connection timeout'),
      expected: true,
    },
    { title: 'a query the server did not answer', error: new Error('Query read timeout'), expected: true },
    { title: 'a statement Postgres cancelled (57014)', error: aPostgresError('57014'), expected: true },
    { title: 'a lock Postgres gave up waiting for (55P03)', error: aPostgresError('55P03'), expected: true },
    { title: 'another Postgres error', error: aPostgresError('42P01'), expected: false },
    { title: 'a unique violation', error: aUniqueViolation(), expected: false },
    { title: 'a database that refuses the connection', error: new Error('connect ECONNREFUSED'), expected: false },
    { title: 'a bug', error: new TypeError('x is not a function'), expected: false },
    { title: 'an object with the message of a timeout', error: { message: 'Query read timeout' }, expected: false },
    { title: 'undefined', error: undefined, expected: false },
  ];

  for (const { title, error, expected } of cases) {
    test(`is ${expected} for ${title}`, () => {
      assert.equal(isDatabaseTimeout(error), expected);
    });
  }
});
