// Written with the help of Claude
import { mock } from 'node:test';
import type { TransactionRunner } from '../../../dist/core/common/transaction-runner.js';
import type { Transaction } from '../../../dist/core/common/transaction.js';
import type { JobQueue } from '../../../dist/core/jobs/adapters/job-queue.js';

/** The transaction the fake runner hands to its work. */
export const TX = { transaction: true } as unknown as Transaction;

/** Runs the work at once with TX; an error passes through, as a rolled back transaction's does. */
export function aTransactionRunner() {
  return { run: mock.fn<TransactionRunner['run']>((work) => work(TX)) };
}

/** A job queue that records what is enqueued. */
export function aJobQueue() {
  return {
    enqueue: mock.fn<JobQueue['enqueue']>(() => Promise.resolve()),
    enqueueMany: mock.fn<JobQueue['enqueueMany']>(() => Promise.resolve()),
    register: mock.fn<JobQueue['register']>(),
    schedule: mock.fn<JobQueue['schedule']>(),
  };
}

/** The jobs enqueued one by one, as [name, payload, transaction]. */
export function enqueued(jobs: ReturnType<typeof aJobQueue>): unknown[][] {
  return jobs.enqueue.mock.calls.map(({ arguments: [name, payload, , tx] }) => [name, payload, tx]);
}
