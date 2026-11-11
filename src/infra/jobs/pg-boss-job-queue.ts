// Written with the help of Claude
import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { fromPrisma, PgBoss, type PrismaTransactionLike } from 'pg-boss';
import type { Transaction } from '../../core/common/transaction.ts';
import { JobQueue } from '../../core/jobs/adapters/job-queue.ts';
import type { EnqueueOptions, JobHandler, QueueOptions } from '../../core/jobs/types/job.ts';

/** Every queue gets these: a failed job is retried three times, each wait longer than the last. */
const DEFAULT_RETRY = { retryLimit: 3, retryBackoff: true } as const;

const SCHEMA = 'pgboss';
const RETRY_START_MS = 5_000;
const ENQUEUE_WAIT_MS = 5_000;
const STOP_TIMEOUT_MS = 30_000;

export interface PgBossJobQueueOptions {
  /** Seconds between two checks of an idle queue for new jobs (at least 0.5). */
  pollingIntervalSeconds?: number;
}

/**
 * The job queue on pg-boss. The tables come from the `job_queue` migration, so pg-boss never changes the schema
 * (`migrate: false`) and the role of `connectionString` needs no more than reading and writing them. Queues
 * (rows, not tables) are created on start. Starting does not hold the application back: the database may be down
 * or slow, and the API serves what does not need jobs meanwhile. A failed start is retried until it works.
 */
export class PgBossJobQueue extends JobQueue implements OnApplicationBootstrap, OnModuleDestroy {
  readonly #logger = new Logger(PgBossJobQueue.name);
  readonly #handlers = new Map<string, JobHandler<object>>();
  readonly #queueOptions = new Map<string, QueueOptions>();
  /** By name and key, so a name can have several schedules. */
  readonly #schedules = new Map<string, { name: string; cron: string; payload?: object; key?: string }>();
  readonly #queues = new Set<string>();
  readonly #started = Promise.withResolvers<PgBoss>();
  #boss?: PgBoss;
  #stopping = false;
  #retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly connectionString: string,
    private readonly options: PgBossJobQueueOptions = {},
  ) {
    super();
    // Nobody may be waiting yet when a start fails for good.
    this.#started.promise.catch(() => {});
  }

  onApplicationBootstrap(): void {
    void this.#start(RETRY_START_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.#stopping = true;
    clearTimeout(this.#retryTimer);
    // In-flight handlers get time to finish; a job cut off anyway is retried like any failed job.
    await this.#boss?.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
  }

  /** Resolves once the queue is running. Tests wait for it; the application does not. */
  async whenStarted(): Promise<void> {
    await this.#started.promise;
  }

  register<Payload extends object>(name: string, handler: JobHandler<Payload>, options?: QueueOptions): void {
    if (this.#handlers.has(name)) {
      throw new Error(`The job "${name}" already has a handler`);
    }
    this.#handlers.set(name, handler as JobHandler<object>);
    if (options) {
      this.#queueOptions.set(name, options);
      // A queue that already exists keeps its options; they are set on it once more.
      this.#queues.delete(name);
    }
    if (this.#boss) {
      void this.#attach(this.#boss, name).catch((error: unknown) => this.#logger.error(error));
    }
  }

  schedule(name: string, cron: string, payload?: object, key?: string): void {
    const id = scheduleId(name, key);
    this.#schedules.set(id, { name, cron, payload, key });
    if (this.#boss) {
      void this.#applySchedule(this.#boss, id).catch((error: unknown) => this.#logger.error(error));
    }
  }

  async enqueue<Payload extends object>(
    name: string,
    payload: Payload,
    options?: EnqueueOptions,
    tx?: Transaction,
  ): Promise<void> {
    const boss = await this.#running();
    await this.#ensureQueue(boss, name);
    await boss.send(name, payload, {
      ...(options?.runAt && { startAfter: options.runAt }),
      ...(options?.delayMs !== undefined && { startAfter: options.delayMs / 1000 }),
      ...(tx && { db: fromPrisma(tx as unknown as PrismaTransactionLike) }),
    });
  }

  async #running(): Promise<PgBoss> {
    const timeout = AbortSignal.timeout(ENQUEUE_WAIT_MS);
    return Promise.race([
      this.#started.promise,
      new Promise<never>((_, reject) =>
        timeout.addEventListener('abort', () => reject(new Error('The job queue is not running')), { once: true }),
      ),
    ]);
  }

  async #start(retryInMs: number): Promise<void> {
    const boss = new PgBoss({
      connectionString: this.connectionString,
      schema: SCHEMA,
      migrate: false,
      // Rebuilding bloated indexes needs their owner, which the application's role is not.
      reindex: false,
    });
    boss.on('error', (error) => this.#logger.error(error));
    try {
      await boss.start();
      const scheduled = [...this.#schedules.values()].map(({ name }) => name);
      for (const name of new Set([...this.#handlers.keys(), ...scheduled])) {
        await this.#ensureQueue(boss, name);
      }
      for (const name of this.#handlers.keys()) {
        await this.#attach(boss, name);
      }
      for (const id of this.#schedules.keys()) {
        await this.#applySchedule(boss, id);
      }
    } catch (error) {
      this.#logger.error(`The job queue did not start, trying again in ${retryInMs / 1000} s`, error);
      await boss.stop({ graceful: false }).catch(() => {});
      this.#queues.clear();
      if (!this.#stopping) {
        this.#retryTimer = setTimeout(() => void this.#start(retryInMs), retryInMs);
      }
      return;
    }
    this.#boss = boss;
    this.#started.resolve(boss);
  }

  /**
   * Idempotent: a queue that exists is left as it is, except that the options its handler was registered with are
   * set on it. Creates a row in pgboss.queue, no table.
   */
  async #ensureQueue(boss: PgBoss, name: string): Promise<void> {
    if (this.#queues.has(name)) {
      return;
    }
    const options = this.#queueOptions.get(name);
    const settings = {
      ...DEFAULT_RETRY,
      ...(options?.retryLimit !== undefined && { retryLimit: options.retryLimit }),
      ...(options?.timeoutSeconds !== undefined && { expireInSeconds: options.timeoutSeconds }),
    };
    await boss.createQueue(name, settings);
    if (options) {
      await boss.updateQueue(name, settings);
    }
    this.#queues.add(name);
  }

  async #attach(boss: PgBoss, name: string): Promise<void> {
    const handler = this.#handlers.get(name)!;
    await this.#ensureQueue(boss, name);
    // pg-boss refuses an interval that is set but undefined, so it is left out unless given.
    const { pollingIntervalSeconds } = this.options;
    const options = pollingIntervalSeconds === undefined ? {} : { pollingIntervalSeconds };
    await boss.work<object>(name, options, async (jobs) => {
      for (const { id, data } of jobs) {
        await handler({ id, name, payload: data });
      }
    });
  }

  async #applySchedule(boss: PgBoss, id: string): Promise<void> {
    const { name, cron, payload, key } = this.#schedules.get(id)!;
    await this.#ensureQueue(boss, name);
    await boss.schedule(name, cron, payload, key === undefined ? undefined : { key });
  }
}

function scheduleId(name: string, key?: string): string {
  return key === undefined ? name : `${name}\n${key}`;
}
