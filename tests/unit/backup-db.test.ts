// Written with the help of Claude
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

const script = join(import.meta.dirname, '../../deploy/backup-db.sh');

const refused = 'pg_dump: error: connection to server at "db" (172.21.0.2), port 5432 failed: Connection refused';

// Stand-ins for the Postgres tools: each logs its call, and FAKE_* makes it fail.
const fakes = {
  timeout: 'shift\nexec "$@"',
  pg_dump: `echo pg_dump >>"$FAKE_LOG"
if [ -n "$FAKE_DUMP_STATUS" ]; then
  echo "$FAKE_DUMP_ERROR" >&2
  exit "$FAKE_DUMP_STATUS"
fi
for arg; do case $arg in --file=*) echo PGDMP >"\${arg#--file=}" ;; esac; done`,
  pg_restore: `if [ "$FAKE_RESTORE" = fail ]; then
  echo 'pg_restore: error: input file does not appear to be a valid archive' >&2
  exit 1
fi`,
  psql: `line=psql
while [ $# -gt 0 ]; do
  case $1 in -v) case $2 in succeeded=* | attempts=* | size=* | reason=*) line="$line $2" ;; esac; shift ;; esac
  shift
done
echo "$line" >>"$FAKE_LOG"
[ "$FAKE_PSQL" != fail ]`,
};

let root: string;
let bin: string;
let backups: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'backup-db-'));
  bin = join(root, 'bin');
  backups = join(root, 'backups');
  mkdirSync(bin);
  mkdirSync(backups);
  for (const [name, body] of Object.entries(fakes)) {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

type Failures = { dumpError?: string; dumpStatus?: number; restore?: boolean; psql?: boolean };

function run(mode: string, fail: Failures = {}) {
  const result = spawnSync('sh', [script, mode], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      PGDATABASE: 'nearby',
      BACKUP_ROOT: backups,
      BACKUP_RETRY_DELAY_SECONDS: '0',
      FAKE_LOG: join(root, 'calls.log'),
      FAKE_DUMP_ERROR: fail.dumpError ?? '',
      // An error message alone fails with status 1.
      FAKE_DUMP_STATUS: String(fail.dumpStatus ?? (fail.dumpError === undefined ? '' : 1)),
      FAKE_RESTORE: fail.restore ? 'fail' : 'ok',
      FAKE_PSQL: fail.psql ? 'fail' : 'ok',
    },
  });
  const log = join(root, 'calls.log');
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  return { status: result.status, stderr: result.stderr, calls };
}

function files(folder: string): string[] {
  return existsSync(join(backups, folder)) ? readdirSync(join(backups, folder)) : [];
}

describe('backup-db.sh nightly', () => {
  test('keeps a copy that pg_restore can read and records the night as succeeded', () => {
    const { status, calls } = run('nightly');

    assert.equal(status, 0);
    assert.match(files('daily').join(), /^nearby-.*\.dump$/);
    assert.deepEqual(calls, ['pg_dump', 'psql succeeded=true attempts=1 size=6 reason=']);
    assert.equal(run('check').status, 0);
  });

  test('tries three times, leaves no partial file and records the cause as a code, the details only in the log', () => {
    const { status, stderr, calls } = run('nightly', { dumpError: refused });

    assert.equal(status, 1);
    assert.deepEqual(files('daily'), []);
    assert.deepEqual(calls, [
      'pg_dump',
      'pg_dump',
      'pg_dump',
      'psql succeeded=false attempts=3 size= reason=unreachable',
    ]);
    assert.match(stderr, /172\.21\.0\.2/);
    assert.match(stderr, /failed 3 times/);
    assert.notEqual(run('check').status, 0);
  });

  test('records the attempt that succeeded after a failed one', () => {
    run('nightly', { dumpError: refused });
    writeFileSync(join(root, 'calls.log'), '');
    const { calls } = run('nightly');

    assert.equal(calls.at(-1), 'psql succeeded=true attempts=1 size=6 reason=');
  });

  test('drops a copy that pg_restore cannot read', () => {
    const { status, calls } = run('nightly', { restore: true });

    assert.equal(status, 1);
    assert.deepEqual(files('daily'), []);
    assert.equal(calls.at(-1), 'psql succeeded=false attempts=3 size= reason=unreadable');
  });

  test('keeps backing up when the run cannot be recorded', () => {
    const { status, stderr } = run('nightly', { psql: true });

    assert.equal(status, 0);
    assert.equal(files('daily').length, 1);
    assert.match(stderr, /Could not record the backup/);
  });

  test('a good night after a failed one makes the check pass again', () => {
    run('nightly', { dumpError: refused });
    run('nightly');

    assert.equal(run('check').status, 0);
  });
});

describe('backup-db.sh failure reasons', () => {
  const cases: [string, Failures, string][] = [
    [
      'a refused sign-in',
      {
        dumpError:
          'pg_dump: error: connection to server at "db" failed: FATAL:  password authentication failed for user "nearby"',
      },
      'auth_failed',
    ],
    [
      'a host that cannot be found',
      { dumpError: 'pg_dump: error: could not translate host name "db" to address' },
      'unreachable',
    ],
    ['a refused connection', { dumpError: refused }, 'unreachable'],
    [
      'a lock held too long',
      { dumpError: 'pg_dump: error: query failed: ERROR:  canceling statement due to lock timeout' },
      'locked',
    ],
    ['a dump stopped after 15 minutes', { dumpStatus: 124 }, 'timeout'],
    ['an unknown error', { dumpError: 'pg_dump: error: something else' }, 'failed'],
  ];
  for (const [name, failures, reason] of cases) {
    test(`records ${name} as ${reason}`, () => {
      assert.equal(run('nightly', failures).calls.at(-1), `psql succeeded=false attempts=3 size= reason=${reason}`);
    });
  }
});

describe('backup-db.sh check', () => {
  test('fails before the first nightly backup', () => {
    assert.notEqual(run('check').status, 0);
  });

  test('fails when the newest nightly copy is older than 26 hours', () => {
    run('nightly');
    const [copy] = files('daily');
    const old = new Date(Date.now() - 27 * 60 * 60 * 1000);
    utimesSync(join(backups, 'daily', copy), old, old);

    assert.notEqual(run('check').status, 0);
  });
});

describe('backup-db.sh now', () => {
  test('fails at once, without retries or a record, so the deploy stops', () => {
    const { status, calls } = run('now', { dumpError: refused });

    assert.notEqual(status, 0);
    assert.deepEqual(calls, ['pg_dump']);
    assert.deepEqual(files('manual'), []);
  });
});
