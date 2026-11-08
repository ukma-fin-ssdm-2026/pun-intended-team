// Written with the help of Claude
// REL-05 boundary: the API reads PORT and AUTH_RATE_LIMIT_PER_MINUTE from the environment when it starts.
// An empty value takes the default, and a value that is not a whole number in range stops the start with a
// message that names the variable and the value. Before, an empty AUTH_RATE_LIMIT_PER_MINUTE became 0 and
// the limit refused every sign-in, and a bad PORT either gave Node's own error or a random port.
// Needs no database. Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { after, before, describe, test } from 'node:test';
import { promisify } from 'node:util';
import { apiEnvironment, freePort, startApi, stopApi } from './api-process.ts';

const PORT = 'PORT';
const RATE_LIMIT = 'AUTH_RATE_LIMIT_PER_MINUTE';

const REFUSED_PORTS = [
  { title: 'zero', value: '0' },
  { title: 'negative', value: '-1' },
  { title: 'not a number', value: 'abc' },
  { title: 'above 65535', value: '70000' },
  { title: 'not a whole number', value: '1.5' },
];

const REFUSED_LIMITS = [
  { title: 'zero', value: '0' },
  { title: 'negative', value: '-5' },
  { title: 'not a number', value: 'abc' },
  { title: 'not a whole number', value: '1.5' },
];

let env: NodeJS.ProcessEnv;
let removeKeys: () => void;

before(async () => {
  // Nothing listens on a port freePort has just given back; the API needs no database to start.
  const result = apiEnvironment(`postgresql://nearby_main:password@127.0.0.1:${await freePort()}/nearby`);
  env = result.env;
  removeKeys = result.cleanup;
});

after(() => {
  removeKeys();
});

/** Starts the built API with `overrides` and expects it to stop with code 1, naming `variable` and `value`. */
async function assertRefused(overrides: NodeJS.ProcessEnv, variable: string, value: string): Promise<void> {
  const start = promisify(execFile)(process.execPath, ['dist/api/main.js'], {
    env: { ...env, PORT: String(await freePort()), ...overrides },
    // An API that starts instead is stopped after 10 s, and the test fails.
    timeout: 10_000,
  });

  await assert.rejects(start, (error: { code: unknown; stderr: string }) => {
    assert.equal(error.code, 1);
    // The name is checked as well as the value: Node itself refuses some bad ports, without naming the variable.
    assert.ok(error.stderr.includes(`${variable} must be `), error.stderr);
    assert.ok(error.stderr.includes(`got "${value}"`), error.stderr);
    return true;
  });
}

// REL-05
describe(PORT, () => {
  for (const { title, value } of REFUSED_PORTS) {
    test(`stops the start with a value that is ${title}, naming the variable`, async () => {
      await assertRefused({ [PORT]: value }, PORT, value);
    });
  }
});

// REL-05
describe(RATE_LIMIT, () => {
  for (const { title, value } of REFUSED_LIMITS) {
    test(`stops the start with a value that is ${title}, naming the variable`, async () => {
      await assertRefused({ [RATE_LIMIT]: value }, RATE_LIMIT, value);
    });
  }

  test('takes the default of 20 for an empty value, so the first sign-in request is not refused', async () => {
    const api = await startApi({ ...env, [RATE_LIMIT]: '' });

    try {
      const response = await fetch(`${api.url}/api/v1/auth/google/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: 'not-a-token' }),
      });

      // An empty value became 0, a limit that refuses every request, so the first one was already 429.
      assert.notEqual(response.status, 429);
    } finally {
      await stopApi(api.child);
    }
  });

  test('starts the API with a value of 1, the smallest limit', async () => {
    const api = await startApi({ ...env, [RATE_LIMIT]: '1' });

    try {
      // startApi resolves once /health answers, so the API is up and still running.
      assert.equal(api.child.exitCode, null);
    } finally {
      await stopApi(api.child);
    }
  });
});
