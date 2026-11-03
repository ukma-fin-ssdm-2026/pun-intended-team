// Written with the help of Claude
import type { PoolConfig } from 'pg';
import { Prisma } from './generated/client.ts';

/** Time limits of the API's database calls, in milliseconds (REL-01). */
export interface DatabaseTimeouts {
  connectMs: number;
  statementMs: number;
  lockMs: number;
  idleInTransactionMs: number;
}

const variables = {
  connectMs: { name: 'DATABASE_CONNECT_TIMEOUT_MS', fallback: 5_000 },
  statementMs: { name: 'DATABASE_STATEMENT_TIMEOUT_MS', fallback: 10_000 },
  lockMs: { name: 'DATABASE_LOCK_TIMEOUT_MS', fallback: 3_000 },
  idleInTransactionMs: { name: 'DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS', fallback: 15_000 },
} as const;

// How long the client waits after the server's statement_timeout should have cancelled the query,
// for a server that has stopped answering at all.
const QUERY_TIMEOUT_MARGIN_MS = 1_000;

/** Read at startup; an unset or empty variable takes its default, anything but a positive integer stops the start. */
export function loadDatabaseTimeouts(env: NodeJS.ProcessEnv = process.env): DatabaseTimeouts {
  const read = ({ name, fallback }: { name: string; fallback: number }): number => {
    const value = env[name];
    if (value === undefined || value === '') {
      return fallback;
    }
    if (!/^[1-9]\d*$/.test(value)) {
      throw new Error(`${name} must be a positive number of milliseconds, got "${value}"`);
    }
    return Number(value);
  };
  const timeouts = {
    connectMs: read(variables.connectMs),
    statementMs: read(variables.statementMs),
    lockMs: read(variables.lockMs),
    idleInTransactionMs: read(variables.idleInTransactionMs),
  };
  if (timeouts.lockMs > timeouts.statementMs) {
    throw new Error('DATABASE_LOCK_TIMEOUT_MS must not exceed DATABASE_STATEMENT_TIMEOUT_MS, or it never fires');
  }
  return timeouts;
}

/** The pg pool config PrismaPg gets: without it pg waits for a connection and for every query forever. */
export function databasePoolConfig(connectionString: string, timeouts: DatabaseTimeouts): PoolConfig {
  return {
    connectionString,
    connectionTimeoutMillis: timeouts.connectMs,
    statement_timeout: timeouts.statementMs,
    lock_timeout: timeouts.lockMs,
    idle_in_transaction_session_timeout: timeouts.idleInTransactionMs,
    query_timeout: timeouts.statementMs + QUERY_TIMEOUT_MARGIN_MS,
  };
}

// pg throws these as plain errors, and PrismaPg passes them on unwrapped.
const clientTimeoutMessages = new Set([
  // A pool checkout waited connectionTimeoutMillis for a free connection
  'timeout exceeded when trying to connect',
  // A new connection got no answer to its startup within connectionTimeoutMillis
  'Connection terminated due to connection timeout',
  // A query got no answer within query_timeout
  'Query read timeout',
]);

// Postgres cancelled the statement: query_canceled (statement_timeout) and lock_not_available (lock_timeout).
const serverTimeoutCodes = new Set(['57014', '55P03']);

/** Whether a database call failed because it ran out of time, rather than for a bug or bad data. */
export function isDatabaseTimeout(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const cause = (error.meta?.driverAdapterError as { cause?: { originalCode?: unknown } } | undefined)?.cause;
    return typeof cause?.originalCode === 'string' && serverTimeoutCodes.has(cause.originalCode);
  }
  return error instanceof Error && clientTimeoutMessages.has(error.message);
}
