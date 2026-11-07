# Database Access

## Decision

Each process connects with its **own database role**, so a compromised import service cannot read personal data (ADR-001). Schema changes use a separate role that no running process holds.

## Roles

| Role | Used by | Can do |
|---|---|---|
| `nearby`, the owner (`POSTGRES_USER`) | Prisma migrations (CI / deploy) | Change the schema. Never used at runtime. |
| `nearby_main` | Main server (CMP-02) | Read and write all application tables and the job queue's tables in the schema `pgboss` ([job queue](job-queue.md)); no schema changes |
| `nearby_import` | Import service (CMP-03) | Write imported `events` and `venues`, `import_runs`, skipped records; enqueue `event.changed`. |

Roles and grants are created in a migration; each process gets its own connection string from the env file on its host.

## Time Limits

Every database call of the main server has a time limit, so a locked table or a database that stops answering ends a request with `503 SERVICE_UNAVAILABLE` instead of holding it open (REL-01). [`database-timeouts.ts`](../../../src/infra/prisma/database-timeouts.ts) reads them from the `DATABASE_*_TIMEOUT_MS` variables ([README](../../../README.md)) and hands them to the pg pool of `PrismaPg`: the wait for a connection, `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, and a client `query_timeout` 1 s after the statement timeout. The import service and migrations do not use them yet.

## Transactions

`core` starts a transaction through the abstract class `TransactionRunner` ([`transaction-runner.ts`](../../../src/core/common/transaction-runner.ts)), which `InfraModule` binds to a Prisma interactive transaction. `run` commits when `work` returns and rolls back when it throws. The `tx` it hands over is an opaque `Transaction`; only `infra` knows it is a Prisma transaction client.

```ts
await this.transactions.run(async (tx) => {
  const match = await this.matches.create(proposal, tx);
  await this.jobs.enqueue('matching.expire', { matchId: match.id }, { runAt: match.validUntil }, tx);
});
```

Repositories join a transaction only where a method takes `tx`. No method does yet; add the parameter when a use case needs it, in the abstract class and in the Prisma repository:

```ts
// core/matching/repositories/matches.repository.ts
abstract create(proposal: MatchProposal, tx?: Transaction): Promise<Match>;

// infra/prisma/prisma-matches.repository.ts
async create(proposal: MatchProposal, tx?: Transaction): Promise<Match> {
  const client = (tx as unknown as Prisma.TransactionClient | undefined) ?? this.prisma;
  return toMatch(await client.match.create({ data: toRow(proposal) }));
}
```

A transaction that takes longer than Prisma's interactive-transaction timeout is rolled back: by default 5 s to run and 2 s to wait for a connection (Prisma documentation). Keep `work` short, and do no calls to other services in it. Without `tx` a repository method runs on its own, as before.

A repository that opens its own transaction for one method (`updateLockout`, `createWithinLimit`) is fine while the method is self-contained; a use case that spans several repositories or enqueues a job uses `TransactionRunner`.

## Not Done

**No row-level security** on `events.source` and `venues.source`. It would stop the import role from modifying organization-created events and venues, but it fails silently (0 rows affected instead of an error) and the risk is small — a compromised import service can already put bad content into the catalog through imported events. Accepted risk, recorded in the threat model.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
