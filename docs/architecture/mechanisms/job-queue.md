# Job Queue

## Decision

Background work goes through a **job queue inside PostgreSQL** ([ADR-002](../decisions/ADR-002.md)), built on [pg-boss](https://github.com/timgit/pg-boss). `core` knows only the abstract class `JobQueue` ([`job-queue.ts`](../../../src/core/jobs/adapters/job-queue.ts)); [`PgBossJobQueue`](../../../src/infra/jobs/pg-boss-job-queue.ts) implements it and `InfraModule` binds the two, like any other port ([code structure](code-structure.md), rules 7 and 12). The import's long-running process binds it too, in `ImportInfraModule.withJobQueue()`, as `nearby_import`. The jobs of the system are listed in the [job catalogue](../high-level-design.md#i3--job-catalogue-pg-boss-in-cmp-04).

## Rules

1. **A job is enqueued in the transaction of the change that causes it.** Start the transaction with `TransactionRunner` ([database access](database-access.md#transactions)) and pass it as the last argument of `enqueue`: the job exists only if the transaction commits, and a rolled back change leaves no job behind. Without `tx` the job is stored at once, on its own.
2. **Delivery is at-least-once.** A handler that throws fails its job, and the job is retried (3 times, each wait longer than the last, `DEFAULT_RETRY` in the adapter). A job that must not run twice is registered with `{ retryLimit: 0 }`, and one that may take longer than 15 minutes with `timeoutSeconds`; `register` sets these on the queue, also when it exists, as for `import.run`. A job can also run twice, so every handler first checks the current state and does nothing when the work is done or no longer wanted.
3. **Handlers are registered explicitly.** A module calls `register` in its `onModuleInit`; there are no decorators and no scanning. One handler per name; names are `<module>.<verb>`, as in the catalogue.
4. **Core never imports pg-boss.** Payloads are plain JSON objects. The adapter reads the transaction as a Prisma transaction (`fromPrisma`), so the transaction must come from `TransactionRunner`.
5. **The schema belongs to a migration.** The `job_queue` migration holds the SQL of `getConstructionPlans('pgboss')`, run by the owner role, and gives `nearby_main` only what it needs: `USAGE` on the schema `pgboss` and `SELECT, INSERT, UPDATE, DELETE` on its tables (the default privileges of the roles migration cover only `public`). pg-boss runs with `migrate: false` and never changes the schema. Queues, which are rows in `pgboss.queue`, are created idempotently when the application starts or when a name is first used. **The pg-boss version is pinned exactly in `package.json`**: a new version has its own schema, which comes with its own migration, written the same way, before the version is raised.
6. **Starting does not hold the application back.** The queue starts in the background and a failed start is retried every 5 s, so the API still answers when the database is slow or down. `enqueue` waits up to 5 s for the queue to run. On `SIGTERM` the application closes (shutdown hooks are enabled in `main.ts`), and the queue lets running handlers finish for up to 30 s.
7. **Schedules are UTC cron expressions** of 5 fields, kept in `pgboss.schedule`; across instances each occurrence runs once, without hand-written locks. A name has one schedule per `key`, so `import.run` has one per provider, each with its own payload.

## Adding a job

Register the handler in the module that consumes the job, and enqueue from the module that produces it.

```ts
// core/notifications/services/notifications.service.ts: the consumer
@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(private readonly jobs: JobQueue) {}

  onModuleInit(): void {
    this.jobs.register<{ notificationId: string }>('notifications.deliver', async ({ payload }) => {
      // Check the current state first: the job may be a repeat, or the notification no longer wanted.
      await this.deliver(payload.notificationId);
    });
  }
}

// core/matching/services/matching.service.ts: the producer, inside the transaction of the change
await this.transactions.run(async (tx) => {
  const match = await this.matches.create(proposal, tx); // the repository method takes `tx`, see database access
  await this.jobs.enqueue('matching.expire', { matchId: match.id }, { runAt: match.validUntil }, tx);
});
```

`options` is `{ delayMs }` or `{ runAt }`; leave it out to run the job as soon as a worker is free. A cron job is `this.jobs.schedule('identity.retention', '0 3 * * *')` in the same `onModuleInit`.

## Testing

[`job-queue.e2e.test.ts`](../../../tests/e2e/job-queue.e2e.test.ts) runs the adapter on the real database as `nearby_main`, with a 0.5 s polling interval: a job in a committed transaction runs, one in a rolled back transaction or in one whose work fails never does, a delayed job does not run before its time, and a handler that fails runs again.

## AI Usage Note

Drafted with Claude Code and reviewed by the team.
