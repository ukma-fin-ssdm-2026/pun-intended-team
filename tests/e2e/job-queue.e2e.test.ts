// Written with the help of Claude
// Integration tests of the job queue (docs/architecture/mechanisms/job-queue.md) on a real PostgreSQL: the pg-boss
// adapter connects as nearby_main, so they also show that the grants of the job_queue migration are enough.
// Jobs are enqueued inside Prisma transactions and the handlers run in this process. The queues have names of their own
// and are removed at the end. Run with `npm run test:e2e`; the database must have all migrations applied and the role
// passwords set (`npm run db:set-passwords`).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import { PgBossJobQueue } from '../../dist/infra/jobs/pg-boss-job-queue.js';
import { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { PrismaTransactionRunner } from '../../dist/infra/prisma/prisma-transaction-runner.js';

const POLLING_INTERVAL_SECONDS = 0.5;
const WAIT_MS = 10_000;

const suffix = randomUUID();
const queueNames = {
  committed: `test.committed.${suffix}`,
  rolledBack: `test.rolled-back.${suffix}`,
  delayed: `test.delayed.${suffix}`,
  retried: `test.retried.${suffix}`,
  scheduled: `test.scheduled.${suffix}`,
};

interface Payload {
  label: string;
}

let queue: PgBossJobQueue;
let prisma: PrismaService;
let transactions: PrismaTransactionRunner;
let admin: pg.Pool;

/** What the handlers of one queue received, with the time each job arrived. */
class Received {
  readonly jobs: { payload: Payload; at: number }[] = [];
  #waiting: { label: string; resolve: (at: number) => void }[] = [];

  record(payload: Payload): void {
    const at = Date.now();
    this.jobs.push({ payload, at });
    for (const waiting of this.#waiting.filter(({ label }) => label === payload.label)) {
      waiting.resolve(at);
    }
  }

  /** Resolves with the time the job `label` arrived, or fails after WAIT_MS. */
  arrival(label: string): Promise<number> {
    const seen = this.jobs.find(({ payload }) => payload.label === label);
    if (seen) {
      return Promise.resolve(seen.at);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`The job "${label}" did not arrive`)), WAIT_MS);
      this.#waiting.push({
        label,
        resolve: (at) => {
          clearTimeout(timer);
          resolve(at);
        },
      });
    });
  }

  labels(): string[] {
    return this.jobs.map(({ payload }) => payload.label);
  }
}

const committed = new Received();
const rolledBack = new Received();
const delayed = new Received();
const retried = new Received();
let retriedAttempts = 0;

/** Enqueues in a transaction that is rolled back when `commit` is false. */
async function enqueueInTransaction(
  name: string,
  payload: Payload,
  commit: boolean,
  options?: Parameters<PgBossJobQueue['enqueue']>[2],
): Promise<void> {
  const rollback = new Error('rollback');
  await transactions
    .run(async (tx) => {
      await queue.enqueue(name, payload, options, tx);
      if (!commit) {
        throw rollback;
      }
    })
    .catch((error: unknown) => {
      if (error !== rollback) {
        throw error;
      }
    });
}

before(async () => {
  // Local settings, as in src/api/common/config.ts; CI sets the variables in the environment.
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
  assert.ok(process.env.MAIN_DATABASE_URL, 'MAIN_DATABASE_URL is not set: see .env.example');
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is not set: see .env.example');
  admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  prisma = new PrismaService();
  transactions = new PrismaTransactionRunner(prisma);

  queue = new PgBossJobQueue(process.env.MAIN_DATABASE_URL, { pollingIntervalSeconds: POLLING_INTERVAL_SECONDS });
  queue.register<Payload>(queueNames.committed, (job) => Promise.resolve(committed.record(job.payload)));
  queue.register<Payload>(queueNames.rolledBack, (job) => Promise.resolve(rolledBack.record(job.payload)));
  queue.register<Payload>(queueNames.delayed, (job) => Promise.resolve(delayed.record(job.payload)));
  queue.schedule(queueNames.scheduled, '* * * * *', { label: 'tick' });
  queue.onApplicationBootstrap();
  await queue.whenStarted();
  // Registered after the start, as a module may do.
  queue.register<Payload>(queueNames.retried, (job) => {
    retriedAttempts += 1;
    if (retriedAttempts === 1) {
      return Promise.reject(new Error('fails the first time'));
    }
    retried.record(job.payload);
    return Promise.resolve();
  });
});

after(async () => {
  await queue?.onModuleDestroy();
  await prisma?.$disconnect();
  if (admin) {
    const names = Object.values(queueNames);
    await admin.query('DELETE FROM pgboss.job WHERE name = ANY($1)', [names]);
    await admin.query('DELETE FROM pgboss.schedule WHERE name = ANY($1)', [names]);
    await admin.query('DELETE FROM pgboss.queue WHERE name = ANY($1)', [names]);
    await admin.end();
  }
});

describe('JobQueue.enqueue', () => {
  test('runs the handler of a job enqueued in a committed transaction', async () => {
    await enqueueInTransaction(queueNames.committed, { label: 'committed' }, true);

    await committed.arrival('committed');

    assert.deepEqual(committed.labels(), ['committed']);
  });

  test('never runs the handler of a job enqueued in a rolled back transaction', async () => {
    await enqueueInTransaction(queueNames.rolledBack, { label: 'rolled back' }, false);
    // Jobs of a queue are fetched in the order they were enqueued, so once this one has run, the queue was polled
    // again after the rolled back one would have been due.
    await queue.enqueue(queueNames.rolledBack, { label: 'sentinel' });

    await rolledBack.arrival('sentinel');

    assert.deepEqual(rolledBack.labels(), ['sentinel']);
  });

  test('stores no job when the work of the transaction fails after the enqueue', async () => {
    const failure = new Error('the work failed');

    await assert.rejects(
      transactions.run(async (tx) => {
        await queue.enqueue(queueNames.rolledBack, { label: 'failed work' }, undefined, tx);
        throw failure;
      }),
      failure,
    );
    await queue.enqueue(queueNames.rolledBack, { label: 'sentinel after failure' });
    await rolledBack.arrival('sentinel after failure');

    assert.ok(!rolledBack.labels().includes('failed work'));
  });

  test('does not run a delayed job before its delay has passed', async () => {
    const delayMs = 2_000;
    const enqueuedAt = Date.now();
    await enqueueInTransaction(queueNames.delayed, { label: 'delayed' }, true, { delayMs });

    const arrivedAt = await delayed.arrival('delayed');

    assert.ok(arrivedAt - enqueuedAt >= delayMs, `ran after ${arrivedAt - enqueuedAt} ms`);
  });

  test('does not run a job before its time', async () => {
    const runAt = new Date(Date.now() + 2_000);
    await enqueueInTransaction(queueNames.delayed, { label: 'timed' }, true, { runAt });

    const arrivedAt = await delayed.arrival('timed');

    assert.ok(arrivedAt >= runAt.getTime(), `ran ${runAt.getTime() - arrivedAt} ms early`);
  });

  test('runs the handler again after it failed', async () => {
    await queue.enqueue(queueNames.retried, { label: 'retried' });

    await retried.arrival('retried');

    assert.equal(retriedAttempts, 2);
  });
});

describe('JobQueue.schedule', () => {
  test('stores the schedule', async () => {
    const { rows } = await admin.query<{ cron: string }>('SELECT cron FROM pgboss.schedule WHERE name = $1', [
      queueNames.scheduled,
    ]);

    assert.deepEqual(rows, [{ cron: '* * * * *' }]);
  });
});
