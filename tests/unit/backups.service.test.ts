// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BackupRunsRepository } from '../../dist/core/admin/repositories/backup-runs.repository.js';
import { BackupsService } from '../../dist/core/admin/services/backups.service.js';
import type { BackupRun } from '../../dist/core/admin/types/backup.js';

const now = new Date('2026-11-07T12:00:00Z');

function succeeded(finishedAt: string): BackupRun {
  return { finishedAt, succeeded: true, attempts: 1, durationSeconds: 12, sizeBytes: 4404019, reason: null };
}

function failed(finishedAt: string): BackupRun {
  return { finishedAt, succeeded: false, attempts: 3, durationSeconds: 0, sizeBytes: null, reason: 'unreachable' };
}

function service(runs: BackupRun[], lastSucceededAt?: string) {
  const limits: number[] = [];
  const repository: BackupRunsRepository = {
    recent: (limit) => {
      limits.push(limit);
      return Promise.resolve(runs.slice(0, limit));
    },
    lastSucceededAt: () => Promise.resolve(lastSucceededAt),
  };
  return { backups: new BackupsService(repository), limits };
}

describe('BackupsService.status', () => {
  test('is null where no nightly backup has run', async () => {
    assert.equal(await service([]).backups.status(now), null);
  });

  test('is up to date when the last backup succeeded less than 26 hours ago', async () => {
    const finishedAt = '2026-11-06T10:00:01.000Z';
    assert.deepEqual(await service([succeeded(finishedAt)]).backups.status(now), {
      lastSucceededAt: finishedAt,
      overdue: false,
    });
  });

  test('is overdue when the last backup succeeded more than 26 hours ago', async () => {
    const finishedAt = '2026-11-06T09:59:59.000Z';
    assert.deepEqual(await service([succeeded(finishedAt)]).backups.status(now), {
      lastSucceededAt: finishedAt,
      overdue: true,
    });
  });

  test('is overdue at once when the last backup failed, and names the last one that succeeded', async () => {
    const { backups } = service([failed('2026-11-07T01:21:00.000Z')], '2026-11-06T01:00:00.000Z');
    assert.deepEqual(await backups.status(now), { lastSucceededAt: '2026-11-06T01:00:00.000Z', overdue: true });
  });

  test('is overdue with no date when no backup has ever succeeded', async () => {
    const { backups } = service([failed('2026-11-07T01:21:00.000Z')]);
    assert.deepEqual(await backups.status(now), { lastSucceededAt: null, overdue: true });
  });
});

describe('BackupsService.history', () => {
  test('lists the last 30 nights, newest first, with the status of the newest', async () => {
    const runs = [failed('2026-11-07T01:21:00.000Z'), succeeded('2026-11-06T01:00:12.000Z')];
    const { backups, limits } = service(runs, '2026-11-06T01:00:12.000Z');

    assert.deepEqual(await backups.history(now), {
      status: { lastSucceededAt: '2026-11-06T01:00:12.000Z', overdue: true },
      items: runs,
    });
    assert.deepEqual(limits, [30]);
  });

  test('has no status and no nights where no backup has run', async () => {
    assert.deepEqual(await service([]).backups.history(now), { status: null, items: [] });
  });
});
