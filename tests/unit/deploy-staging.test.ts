// Written with the help of Claude
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';

const script = readFileSync(join(import.meta.dirname, '../../deploy/deploy-staging.sh'), 'utf8');
// The function alone, as deploy-staging.sh defines it; the rest of the script needs Docker and the registry.
const unknownMigrations = /^migrations_unknown_to\(\) \{\n[\s\S]*?\n\}\n/m.exec(script)?.[0] ?? '';

let repo: string;
let bin: string;

function git(...args: string[]) {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: repo });
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'deploy-staging-'));
  bin = join(repo, '.bin');
  mkdirSync(bin);
  // Stands in for `docker compose exec db psql`: prints FAKE_APPLIED, or fails like a database that is down.
  writeFileSync(join(bin, 'docker'), '#!/bin/sh\n[ "$FAKE_DB" = down ] && exit 1\nprintf "%s" "$FAKE_APPLIED"\n');
  chmodSync(join(bin, 'docker'), 0o755);
  // The earlier commit knows two migrations.
  for (const name of ['20261101_first', '20261102_second']) {
    mkdirSync(join(repo, 'prisma/migrations', name), { recursive: true });
    writeFileSync(join(repo, 'prisma/migrations', name, 'migration.sql'), 'SELECT 1;\n');
  }
  writeFileSync(join(repo, 'prisma/migrations/migration_lock.toml'), 'provider = "postgresql"\n');
  git('init', '-q');
  git('add', 'prisma');
  git('commit', '-q', '-m', 'earlier');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

function unknownTo(commit: string, applied: string[], db: 'up' | 'down' = 'up') {
  const result = spawnSync(
    'bash',
    ['-c', `set -euo pipefail\ncompose=(docker compose)\n${unknownMigrations}\nmigrations_unknown_to ${commit}`],
    {
      cwd: repo,
      encoding: 'utf8',
      env: { PATH: `${bin}:${process.env.PATH}`, FAKE_APPLIED: applied.join('\n'), FAKE_DB: db },
    },
  );
  return { status: result.status, lines: result.stdout.split('\n').filter(Boolean) };
}

// REL-10: a rollback starts the earlier code on a database the failed deploy has already migrated.
describe('deploy-staging.sh migrations_unknown_to', () => {
  test('is defined in the script', () => {
    assert.match(unknownMigrations, /^migrations_unknown_to\(\) \{/);
  });

  test('lists the migrations of the database that the commit does not have', () => {
    const applied = ['20261101_first', '20261102_second', '20261103_third', '20261104_fourth'];

    assert.deepEqual(unknownTo('HEAD', applied), { status: 0, lines: ['20261103_third', '20261104_fourth'] });
  });

  test('lists nothing when the commit knows every migration of the database', () => {
    assert.deepEqual(unknownTo('HEAD', ['20261101_first', '20261102_second']), { status: 0, lines: [] });
    assert.deepEqual(unknownTo('HEAD', ['20261101_first']), { status: 0, lines: [] });
  });

  test('fails when the database cannot be read', () => {
    assert.notEqual(unknownTo('HEAD', [], 'down').status, 0);
  });
});
