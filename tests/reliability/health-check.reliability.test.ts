// Written with the help of Claude
// REL-04 fault injection: the built API (dist/) with a database it cannot use, once refused and once silent.
// /health must answer 503 "unhealthy" with the database down, within its time limit, without the cause in the
// body, and the HEALTHCHECK command of the Dockerfile, which the deploy's rollback and the compose health gate
// trust, must fail on that answer. Needs no database.
// Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { promisify } from 'node:util';
import { type ApiProcess, apiEnvironment, freePort, startApi, stopApi } from './api-process.ts';

// HEALTH_CHECK_TIMEOUT_MS in health.service.ts.
const HEALTH_CHECK_TIMEOUT_MS = 2_000;
// Time for the HTTP round trip on top of the limit.
const SLACK_MS = 1_000;

const UNHEALTHY = { status: 'unhealthy', checks: { database: 'down' } };

/** The command of the Dockerfile's HEALTHCHECK, as Docker runs it in the API container. */
function dockerHealthCheck(): string[] {
  const dockerfile = readFileSync('Dockerfile', 'utf8');
  const command = /^HEALTHCHECK[^\n]*\\\n\s*CMD (\[.*\])$/m.exec(dockerfile)?.[1];
  assert.ok(command, 'The Dockerfile has no HEALTHCHECK with an exec-form CMD');
  return JSON.parse(command) as string[];
}

async function getHealth(url: string): Promise<{ status: number; body: unknown; elapsedMs: number }> {
  const started = performance.now();
  const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS + 10_000) });
  const body: unknown = await response.json();
  return { status: response.status, body, elapsedMs: performance.now() - started };
}

/** Runs the Dockerfile's health check against `url`; resolves with its exit code. */
async function runDockerHealthCheck(url: string): Promise<number> {
  const [file, ...args] = dockerHealthCheck();
  assert.equal(file, 'node');
  try {
    await promisify(execFile)(process.execPath, args, { env: { PORT: new URL(url).port } });
    return 0;
  } catch (error) {
    return (error as { code: number }).code;
  }
}

describe('a database that refuses the connection', () => {
  let api: ApiProcess;
  let removeKeys: () => void;

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

  test('makes /health answer 503 unhealthy with the database down, and logs the cause only', async () => {
    const { status, body } = await getHealth(api.url);

    assert.equal(status, 503);
    assert.deepEqual(body, UNHEALTHY);
    assert.match(api.output(), /Health check: the database is down: .*Can't reach database server/);
  });

  test('fails the HEALTHCHECK of the Dockerfile, which decides the rollback', async () => {
    assert.equal(await runDockerHealthCheck(api.url), 1);
  });
});

describe('a database that accepts the connection and does not answer', () => {
  let api: ApiProcess;
  let removeKeys: () => void;
  let silentDatabase: Server;
  const sockets = new Set<Socket>();

  before(async () => {
    silentDatabase = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => {});
    });
    const port = await freePort();
    await new Promise<void>((resolve) => silentDatabase.listen(port, '127.0.0.1', resolve));
    // The pool's connect timeout stays at its 5 s default, longer than the health check's own limit.
    const { env, cleanup } = apiEnvironment(`postgresql://nearby_main:password@127.0.0.1:${port}/nearby`);
    removeKeys = cleanup;
    api = await startApi(env);
  });

  after(async () => {
    await stopApi(api.child);
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => silentDatabase.close(resolve));
    removeKeys();
  });

  test('makes /health answer 503 unhealthy within the time limit of the health check', async () => {
    const { status, body, elapsedMs } = await getHealth(api.url);

    assert.equal(status, 503);
    assert.deepEqual(body, UNHEALTHY);
    assert.ok(elapsedMs >= HEALTH_CHECK_TIMEOUT_MS, `answered after ${Math.round(elapsedMs)} ms, before the limit`);
    assert.ok(elapsedMs < HEALTH_CHECK_TIMEOUT_MS + SLACK_MS, `answered after ${Math.round(elapsedMs)} ms`);
    assert.match(api.output(), /Health check: the database is down: no answer within 2000 ms/);
  });

  test('fails the HEALTHCHECK of the Dockerfile within its 3 s timeout', async () => {
    const started = performance.now();

    assert.equal(await runDockerHealthCheck(api.url), 1);
    assert.ok(performance.now() - started < 3_000);
  });
});
