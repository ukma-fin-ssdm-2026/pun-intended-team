// Written with the help of Claude
// REL-01 fault injection: the built API (dist/) against a fake Postgres that accepts the connection and then
// stops answering, the way a locked table or a hung server looks from the client. Each request must end with
// 503 within its time limit and log the cause, instead of hanging. Needs no database.
// Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { createServer, type Server, type Socket } from 'node:net';
import { after, afterEach, before, describe, test } from 'node:test';
import { type ApiProcess, apiEnvironment, freePort, startApi, stopApi } from './api-process.ts';

const CONNECT_TIMEOUT_MS = 500;
const STATEMENT_TIMEOUT_MS = 1_000;
// query_timeout is 1 s after the statement timeout (database-timeouts.ts).
const QUERY_TIMEOUT_MS = STATEMENT_TIMEOUT_MS + 1_000;
// Time for the HTTP round trip, the guard and the filter on top of a database limit.
const SLACK_MS = 1_500;
// The pg pool of PrismaPg holds 10 connections by default.
const POOL_SIZE = 10;

const UNAVAILABLE = {
  error: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable. Try again later' },
};

/**
 * How the fake Postgres behaves: `silent` never answers the startup, `no-answer` completes the startup and never
 * answers a query, `cancel` answers every query with the error Postgres sends when statement_timeout fires.
 */
type FakeMode = 'silent' | 'no-answer' | 'cancel';

const AUTHENTICATION_OK = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0]);
const READY_FOR_QUERY = Buffer.from([0x5a, 0, 0, 0, 5, 0x49]);
// The Sync message that ends every query of the extended protocol pg uses.
const SYNC = Buffer.from([0x53, 0, 0, 0, 4]);

let apiEnv: NodeJS.ProcessEnv;
let removeKeys: () => void;
let fakeDatabase: Server;
let fakeDatabasePort: number;
let mode: FakeMode = 'silent';
const sockets = new Set<Socket>();

/** An ErrorResponse message of the Postgres protocol, followed by ReadyForQuery. */
function postgresError(code: string, message: string): Buffer {
  const fields = Buffer.from(`SERROR\0VERROR\0C${code}\0M${message}\0\0`);
  const length = Buffer.alloc(4);
  length.writeInt32BE(fields.length + 4);
  return Buffer.concat([Buffer.from('E'), length, fields, READY_FOR_QUERY]);
}

function onConnection(socket: Socket): void {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => {});
  let started = false;
  socket.on('data', (chunk: Buffer) => {
    if (mode === 'silent') {
      return;
    }
    if (!started) {
      started = true;
      socket.write(Buffer.concat([AUTHENTICATION_OK, READY_FOR_QUERY]));
      return;
    }
    if (mode === 'cancel' && chunk.includes(SYNC)) {
      socket.write(postgresError('57014', 'canceling statement due to statement timeout'));
    }
  });
}

/** GET of a catalog endpoint that reads the database, with a guest token; how long it took to answer. */
async function listCategories(url: string): Promise<{ status: number; body: unknown; elapsedMs: number }> {
  const { accessToken } = (await (await fetch(`${url}/api/v1/auth/guest`, { method: 'POST' })).json()) as {
    accessToken: string;
  };
  const started = performance.now();
  // A guard of its own, so a regression fails the test instead of hanging it.
  const response = await fetch(`${url}/api/v1/categories`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS + 10_000),
  });
  const body: unknown = await response.json();
  return { status: response.status, body, elapsedMs: performance.now() - started };
}

before(async () => {
  fakeDatabase = createServer(onConnection);
  fakeDatabasePort = await freePort();
  await new Promise<void>((resolve) => fakeDatabase.listen(fakeDatabasePort, '127.0.0.1', resolve));
  const { env, cleanup } = apiEnvironment(`postgresql://nearby_main:password@127.0.0.1:${fakeDatabasePort}/nearby`);
  removeKeys = cleanup;
  apiEnv = {
    ...env,
    DATABASE_CONNECT_TIMEOUT_MS: String(CONNECT_TIMEOUT_MS),
    DATABASE_STATEMENT_TIMEOUT_MS: String(STATEMENT_TIMEOUT_MS),
    DATABASE_LOCK_TIMEOUT_MS: String(STATEMENT_TIMEOUT_MS / 2),
  };
});

after(async () => {
  for (const socket of sockets) {
    socket.destroy();
  }
  await new Promise((resolve) => fakeDatabase.close(resolve));
  removeKeys();
});

// REL-01
describe('a database that accepts the connection and does not answer', () => {
  let api: ApiProcess;

  before(async () => {
    api = await startApi(apiEnv);
  });

  after(async () => {
    await stopApi(api.child);
  });

  afterEach(() => {
    for (const socket of sockets) {
      socket.destroy();
    }
  });

  test('ends a request whose connection gets no answer with 503 within the connect timeout, and logs it', async () => {
    mode = 'silent';

    const { status, body, elapsedMs } = await listCategories(api.url);

    assert.equal(status, 503);
    assert.deepEqual(body, UNAVAILABLE);
    assert.ok(elapsedMs < CONNECT_TIMEOUT_MS + SLACK_MS, `answered after ${Math.round(elapsedMs)} ms`);
    assert.match(api.output(), /A dependency timed out: Connection terminated due to connection timeout/);
  });

  test('ends a request whose query gets no answer with 503 within the query timeout, and logs it', async () => {
    mode = 'no-answer';

    const { status, body, elapsedMs } = await listCategories(api.url);

    assert.equal(status, 503);
    assert.deepEqual(body, UNAVAILABLE);
    assert.ok(elapsedMs >= STATEMENT_TIMEOUT_MS, `answered after ${Math.round(elapsedMs)} ms, before the limit`);
    assert.ok(elapsedMs < QUERY_TIMEOUT_MS + SLACK_MS, `answered after ${Math.round(elapsedMs)} ms`);
    assert.match(api.output(), /A dependency timed out: Query read timeout/);
  });

  test('answers 503 to a statement Postgres cancelled, without the database error in the body', async () => {
    mode = 'cancel';

    const { status, body } = await listCategories(api.url);

    assert.equal(status, 503);
    assert.deepEqual(body, UNAVAILABLE);
    assert.match(api.output(), /A dependency timed out: [\s\S]*57014/);
  });

  test('gives each connection back to the pool after a timeout, so more requests than it holds still answer at once', async () => {
    mode = 'cancel';

    const replies = [];
    for (let request = 0; request < POOL_SIZE + 5; request += 1) {
      replies.push(await listCategories(api.url));
    }

    // A connection kept after its error would make the 11th request wait the connect timeout for a free one.
    for (const { status, elapsedMs } of replies) {
      assert.equal(status, 503);
      assert.ok(elapsedMs < CONNECT_TIMEOUT_MS, `a request answered after ${Math.round(elapsedMs)} ms`);
    }
    assert.doesNotMatch(api.output(), /timeout exceeded when trying to connect/);
  });
});
