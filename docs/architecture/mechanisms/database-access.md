# Database Access

## Decision

Each process connects with its **own database role**, so a compromised import service cannot read personal data (ADR-001). Schema changes use a separate role that no running process holds.

## Roles

| Role | Used by | Can do |
|---|---|---|
| `nearby`, the owner (`POSTGRES_USER`) | Prisma migrations (CI / deploy) | Change the schema. Never used at runtime. |
| `nearby_main` | Main server (CMP-02) | Read and write all application tables; no schema changes |
| `nearby_import` | Import service (CMP-03) | Write imported `events` and `venues`, `import_runs`, skipped records; enqueue `event.changed`. |

Roles and grants are created in a migration; each process gets its own connection string from the env file on its host.

## Not Done

**No row-level security** on `events.source` and `venues.source`. It would stop the import role from modifying organization-created events and venues, but it fails silently (0 rows affected instead of an error) and the risk is small — a compromised import service can already put bad content into the catalog through imported events. Accepted risk, recorded in the threat model.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
