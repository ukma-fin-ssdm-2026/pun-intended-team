// Written with the help of Claude
// REL-01 boundary: the API reads the time limits of its database calls from the environment when it starts.
// Edge values of DATABASE_STATEMENT_TIMEOUT_MS must either start the API or stop the start with a message that
// names the variable. Before the one-day limit, a value too long for Node's timers or Postgres started an API
// whose every database call failed. Needs no database. Run with `npm run test:reliability`, which builds first.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { after, before, describe, test } from 'node:test';
import { promisify } from 'node:util';
import { apiEnvironment, freePort, startApi, stopApi } from './api-process.ts';

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

// REL-01
describe(VARIABLE, () => {
  for (const { title, value } of ACCEPTED) {
    test(`starts the API with a value that is ${title}`, async () => {
      const api = await startApi({ ...env, [VARIABLE]: value });

      await stopApi(api.child);
    });
  }

  for (const { title, value } of REFUSED) {
    test(`stops the start with a value that is ${title}, naming the variable`, async () => {
      const start = promisify(execFile)(process.execPath, ['dist/api/main.js'], {
        env: { ...env, [VARIABLE]: value, PORT: String(await freePort()) },
        // An API that starts instead is stopped after 10 s, and the test fails.
        timeout: 10_000,
      });

      await assert.rejects(start, (error: { code: unknown; stderr: string }) => {
        assert.equal(error.code, 1);
        assert.ok(error.stderr.includes(`${VARIABLE} must be `), error.stderr);
        assert.ok(error.stderr.includes(`got "${value}"`), error.stderr);
        return true;
      });
    });
  }
});
