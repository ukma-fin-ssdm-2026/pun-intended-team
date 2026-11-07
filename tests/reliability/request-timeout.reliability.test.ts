// Written with the help of Claude
// REL-02 fault injection: the app's fetchWithTimeout against a local server that stands in for the API and
// misbehaves on purpose: it never answers, it stops in the middle of the body, or it drops the connection.
// Each request must end with an error, which the app already shows as "no connection", instead of waiting
// forever. The 15 s limit runs on mock timers, so the test does not wait 15 s. Needs no database.
// Run with `npm run test:reliability`.
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
// app/package.json has no "type", so Node warns that it loads this file as an ES module; the warning is harmless.
import { fetchWithTimeout } from '../../app/src/api/fetch-with-timeout.ts';

// REQUEST_TIMEOUT_MS in app/src/api/fetch-with-timeout.ts.
const REQUEST_TIMEOUT_MS = 15_000;

/** How the fake API fails: `no-answer` sends nothing, `stalled-body` sends the headers and part of the body. */
type Fault = 'no-answer' | 'stalled-body' | 'dropped';

let fault: Fault;
let server: Server;
let url: string;
const sockets = new Set<Socket>();

function onRequest(request: IncomingMessage, response: ServerResponse): void {
  if (fault === 'stalled-body') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.write('{"items":[');
  } else if (fault === 'dropped') {
    request.socket.destroy();
  }
}

/** Whether `promise` has settled; the mock clock stands still meanwhile. */
async function hasSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  await new Promise((resolve) => setImmediate(resolve));
  return settled;
}

before(async () => {
  server = createServer(onRequest);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/v1/events`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  mock.timers.reset();
  for (const socket of sockets) {
    socket.destroy();
  }
});

// REL-02. A request that is never aborted fails on the suite's own time limit instead of hanging the run.
describe('fetchWithTimeout', { timeout: 10_000 }, () => {
  test('aborts a request the server never answers after 15 s, not before', async () => {
    fault = 'no-answer';

    const request = fetchWithTimeout(new Request(url));
    mock.timers.tick(REQUEST_TIMEOUT_MS - 1);
    assert.equal(await hasSettled(request), false);
    mock.timers.tick(1);

    await assert.rejects(request, { name: 'AbortError' });
  });

  test('aborts reading a body that stops in the middle after 15 s', async () => {
    fault = 'stalled-body';

    const response = await fetchWithTimeout(new Request(url));
    const body = response.text();
    mock.timers.tick(REQUEST_TIMEOUT_MS);

    assert.equal(response.status, 200);
    await assert.rejects(body, { name: 'AbortError' });
  });

  test('rejects a dropped connection at once, without waiting for the limit', async () => {
    fault = 'dropped';

    // The mock clock does not move, so the abort cannot fire: the error comes from the dropped connection.
    await assert.rejects(fetchWithTimeout(new Request(url)), { name: 'TypeError', message: 'fetch failed' });
  });
});
