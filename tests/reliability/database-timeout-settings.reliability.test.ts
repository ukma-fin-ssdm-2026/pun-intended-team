// Written with the help of Claude
// REL-01 boundary: the API reads the time limits of its database calls from the environment when it starts.
// Edge values of DATABASE_STATEMENT_TIMEOUT_MS must either start the API or stop the start with a message that
// names the variable. Before the one-day limit, a value too long for Node's timers or Postgres started an API
// whose every database call failed. Needs no database. Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assertStartRefused, startApi, stopApi, useApiEnvironment } from './api-process.ts';

const VARIABLE = 'DATABASE_STATEMENT_TIMEOUT_MS';

const ACCEPTED = [
  { title: 'empty, which takes the default', value: '' },
  { title: 'one day, the largest value', value: '86400000' },
];

const REFUSED = [
  { title: 'zero', value: '0' },
  { title: 'negative', value: '-1' },
  { title: 'not a number', value: 'abc' },
  { title: 'one day and 1 ms', value: '86400001' },
  { title: 'too long for any timer', value: '99999999999999999999' },
];

const environment = useApiEnvironment();

// REL-01
describe(VARIABLE, () => {
  for (const { title, value } of ACCEPTED) {
    test(`starts the API with a value that is ${title}`, async () => {
      const api = await startApi({ ...environment(), [VARIABLE]: value });

      try {
        // startApi resolves once /health answers, so the API is up and still running.
        assert.equal(api.child.exitCode, null);
      } finally {
        await stopApi(api.child);
      }
    });
  }

  for (const { title, value } of REFUSED) {
    test(`stops the start with a value that is ${title}, naming the variable`, async () => {
      await assertStartRefused(environment(), VARIABLE, value);
    });
  }
});
