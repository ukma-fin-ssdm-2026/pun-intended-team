// Written with the help of Claude
// REL-01 error handling: the built API (dist/) with a database that refuses the connection, so the catalog's
// handler throws an error that is not a timeout. The fix of REL-01 turns only timeouts into 503, so this error
// must stay a 500 with the generic body, its cause must go to the log only, and the API must keep serving.
// Needs no database. Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { type ApiProcess, apiEnvironment, freePort, startApi, stopApi } from './api-process.ts';

const INTERNAL_ERROR = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };

let api: ApiProcess;
let removeKeys: () => void;

async function guestToken(): Promise<string> {
  const response = await fetch(`${api.url}/api/v1/auth/guest`, { method: 'POST' });
  assert.equal(response.status, 200);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

/** GET of a catalog endpoint that reads the database. */
async function listCategories(token: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${api.url}/api/v1/categories`, {
    headers: { authorization: `Bearer ${token}` },
    // A guard of its own, so a regression fails the test instead of hanging it.
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  // Nothing listens on a port freePort has just given back.
  const { env, cleanup } = apiEnvironment(`postgresql://nearby_main:password@127.0.0.1:${await freePort()}/nearby`);
  removeKeys = cleanup;
  api = await startApi(env);
});

after(async () => {
  await stopApi(api.child);
  removeKeys();
});

// REL-01
describe('a request whose handler throws an error that is not a timeout', () => {
  test('answers 500 with the generic body, and logs the cause only', async () => {
    const { status, body } = await listCategories(await guestToken());

    assert.equal(status, 500);
    // The whole body: no database address, Prisma message or stack.
    assert.deepEqual(body, INTERNAL_ERROR);
    // The handler's own query, not the health check's.
    assert.match(api.output(), /Invalid `prisma\.category\.findMany\(\)` invocation:\s*Can't reach database server/);
  });

  test('keeps the API running: the next requests are answered too', async () => {
    const token = await guestToken();

    for (let request = 0; request < 5; request += 1) {
      assert.deepEqual(await listCategories(token), { status: 500, body: INTERNAL_ERROR });
    }
    // A request that does not need the database still works.
    await guestToken();
    assert.equal(api.child.exitCode, null);
  });
});
