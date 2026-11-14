// Written with the help of Claude
// REL-05 boundary: the API reads PORT and AUTH_RATE_LIMIT_PER_MINUTE from the environment when it starts.
// An empty value takes the default, and a value that is not a whole number in range stops the start with a
// message that names the variable and the value. Before, an empty AUTH_RATE_LIMIT_PER_MINUTE became 0 and
// the limit refused every sign-in, and a bad PORT either gave Node's own error or a random port.
// Needs no database. Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assertStartRefused, startApi, stopApi, useApiEnvironment } from './api-process.ts';

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

const environment = useApiEnvironment();

// REL-05
describe(PORT, () => {
  for (const { title, value } of REFUSED_PORTS) {
    test(`stops the start with a value that is ${title}, naming the variable`, async () => {
      await assertStartRefused(environment(), PORT, value);
    });
  }
});

// REL-05
describe(RATE_LIMIT, () => {
  for (const { title, value } of REFUSED_LIMITS) {
    test(`stops the start with a value that is ${title}, naming the variable`, async () => {
      await assertStartRefused(environment(), RATE_LIMIT, value);
    });
  }

  test('takes the default of 20 for an empty value, so the first sign-in request is not refused', async () => {
    const api = await startApi({ ...environment(), [RATE_LIMIT]: '' });

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
    const api = await startApi({ ...environment(), [RATE_LIMIT]: '1' });

    try {
      // startApi resolves once /health answers, so the API is up and still running.
      assert.equal(api.child.exitCode, null);
    } finally {
      await stopApi(api.child);
    }
  });
});
