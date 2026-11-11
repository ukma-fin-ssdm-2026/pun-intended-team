// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { EnqueueOptions, JobHandler, QueueOptions } from '../types/job.ts';

/** The job queue (HLD I3): background work that survives a restart and is retried when its handler fails. */
export abstract class JobQueue {
  /**
   * Adds a job. With `tx` the job is stored in that transaction: it exists only if the transaction commits,
   * and a handler never sees a job whose change was rolled back.
   */
  abstract enqueue<Payload extends object>(
    name: string,
    payload: Payload,
    options?: EnqueueOptions,
    tx?: Transaction,
  ): Promise<void>;

  /**
   * Sets the handler of the jobs called `name`. A module calls it in `onModuleInit`; one handler per name. `options`
   * apply to every job of the name, also to the ones another process enqueues.
   */
  abstract register<Payload extends object>(name: string, handler: JobHandler<Payload>, options?: QueueOptions): void;

  /**
   * Enqueues `name` on a cron schedule (UTC). Across instances each occurrence runs once; calling it again with
   * another `cron` replaces the schedule. A name has one schedule per `key`, e.g. one per provider with its own payload.
   */
  abstract schedule(name: string, cron: string, payload?: object, key?: string): void;
}
