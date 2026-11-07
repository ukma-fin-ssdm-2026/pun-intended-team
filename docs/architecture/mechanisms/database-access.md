# Database Access

## Decision

Each process connects with its **own database role**, so a compromised import service cannot read personal data (ADR-001). Schema changes use a separate role that no running process holds.

## Roles

| Role | Used by | Can do |
|---|---|---|
| `nearby`, the owner (`POSTGRES_USER`) | Prisma migrations (CI / deploy); the nightly backup until it has a role of its own | Change the schema. At runtime only the backup uses it: to dump the database and write `backup_runs`. |
| `nearby_main` | Main server (CMP-02) | Read and write all application tables; no schema changes |
| `nearby_import` | Import service (CMP-03) | Write imported `events` and `venues`, `import_runs`, skipped records; enqueue `event.changed`. |

Roles and grants are created in a migration; each process gets its own connection string from the env file on its host.

## Time Limits

Every database call of the main server has a time limit, so a locked table or a database that stops answering ends a request with `503 SERVICE_UNAVAILABLE` instead of holding it open (REL-01). [`database-timeouts.ts`](../../../src/infra/prisma/database-timeouts.ts) reads them from the `DATABASE_*_TIMEOUT_MS` variables ([README](../../../README.md)) and hands them to the pg pool of `PrismaPg`: the wait for a connection, `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, and a client `query_timeout` 1 s after the statement timeout. The import service and migrations do not use them yet.

## Not Done

**No row-level security** on `events.source` and `venues.source`. It would stop the import role from modifying organization-created events and venues, but it fails silently (0 rows affected instead of an error) and the risk is small — a compromised import service can already put bad content into the catalog through imported events. Accepted risk, recorded in the threat model.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
