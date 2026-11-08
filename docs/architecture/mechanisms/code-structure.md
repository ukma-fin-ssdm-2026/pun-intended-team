# Code Structure

## Decision

The main server (CMP-02) is split into three layers. **`src/api/`** handles HTTP only. **`src/core/`** holds the business logic, one folder per HLD module, with no HTTP and no database in it. **`src/infra/`** talks to the database and external services, behind interfaces that `core` defines (ports and adapters). Every entry point reuses `core` directly, without going through the HTTP layer: the API, pg-boss jobs, the import service (CMP-03) and admin stats.

## Layout

The catalog module as the example; every other module follows the same pattern.

How the classes depend on each other: [code structure diagram](../uml/rendered/code-structure.svg) (source: [`uml/code-structure.puml`](../uml/code-structure.puml)).

```
src/
  api/                          HTTP only
    main.ts, app.module.ts
    common/                     endpoint, auth, api-exception, filter, adapter, openapi, registry, routes, tags, config
      schemas/                  common.ts, errors.ts
    catalog/
      catalog-api.module.ts     imports core's CatalogModule, declares the controllers
      controllers/              events, categories, admin-categories
      schemas/                  events.ts, categories.ts
    system/
      system-api.module.ts
      controllers/  schemas/
  core/                         business logic, no HTTP
    common/                     domain-error.ts, kyiv-time.ts, catalog-window.ts, page.ts, slug.ts, transaction.ts, transaction-runner.ts
    catalog/
      catalog.module.ts         provides + exports EventsService, CategoriesService
      repositories/             events, categories, venues, organizations (abstract: what core needs from storage)
      services/                 events.service.ts, categories.service.ts, category-name.ts (how a category name is saved)
      types/                    event, category, venue, organization
    jobs/                       the job queue port (adapters/job-queue.ts, abstract; types/job.ts); no Nest module, InfraModule provides it
    system/                     HealthService behind /health; adapters/database-probe.ts (abstract: does the database answer)
    import/                     the import (CMP-03); only src/import/ loads it, never the API
      import.module.ts          provides + exports EventImportService; depends on no other module
      adapters/                 event-provider.ts (abstract: one external listing service), geocoder.ts (abstract: coordinates of a venue)
      repositories/             imported-events (the import's storage, role nearby_import: reads categories, writes events, venues, runs, skipped records)
      services/                 event-import.service.ts
      types/                    import (ImportedEvent.categorySlug: the providers' adapters map genres to category slugs, which never change)
  infra/                        data access and external services
    infra.module.ts             binds every repository to its implementation
    import-infra.module.ts      the import's bindings (ImportPrismaService, ImportedEventsRepository, the EventProviders, Geocoder), loaded by src/import/ only, without InfraModule
    prisma/                     PrismaService (role nearby_main), ImportPrismaService (role nearby_import), one Prisma repository per core repository, catalog-rows.ts (venue and event rows to core types); generated/ is the Prisma client
    stubs/                      the import's in-memory repository (imported-events) and data.ts, only for the unit test of the import catalog
    auth/                       adapters for the identity module: access tokens, Google ID tokens, password and code hashing, key files
    jobs/                       PgBossJobQueue: the job queue on pg-boss ([job queue](job-queue.md))
    messaging/                  MessagingProvider implementations: Telegram Gateway with the TurboSMS fallback, console, disabled
    providers/                  one adapter per external event provider (artwizard-, karabas-event-provider.ts), the polite HTTP client they share, import-settings.ts
    geocoding/                  Geocoder implementation (nominatim-geocoder.ts)
  import/                       main.ts, app.module.ts: the import service (CMP-03), no HTTP; reads IMPORT_DATABASE_URL and the import settings of .env.example
  scripts/                      generate-spec.ts (npm run docs:generate), generate-keys.ts, set-role-passwords.ts
  mcp/                          MCP server generated from the spec; a separate Node project, not edited by hand
```

## Rules

1. **`api` → `core` ← `infra`.** `core` imports nothing from either: `api` calls its services, and `infra` implements its repositories. `api/app.module.ts` brings all three together.
2. **Controllers only deal with HTTP.** A controller declares the endpoint with `@Endpoint`, receives the validated input, calls a service and returns its result. It contains no business rules.
3. **Business logic lives in `core` services**, including calculations. For example, each module exposes `stats()` in its own service, and admin stats only combine them.
4. **A module with endpoints has two Nest modules.** The `core` module (`CatalogModule`) provides and exports the services. The `api` module (`CatalogApiModule`) imports it and declares the controllers.
5. **API schemas are separate from domain types.** `api/*/schemas/` holds the zod request and response schemas: the DTOs, and the source of the OpenAPI spec. `core/*/types/` holds plain TypeScript entities together with service inputs. Controllers may return domain objects: `@Endpoint` parses every success response with its schema, so fields the schema does not declare (internal or sensitive ones) never reach the client. Request body schemas are the opposite: `z.strictObject`, so an unknown field is a `400`.
6. **`core` errors carry a code, not a status.** `core` throws `DomainError` with a code (`NOT_FOUND`, `CONFLICT`, one code per business rule). `api` maps each code to a status (`api-exception.ts`), and `ApiExceptionFilter` is the only place that builds `ErrorResponse`. Codes that only HTTP raises (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`) stay in `api`; `app.module.ts` passes infra's `isDatabaseTimeout` to the filter, which answers the errors it accepts with `SERVICE_UNAVAILABLE`. Statuses are listed in [api-design.md](../../api/api-design.md).
7. **Services reach storage only through repositories.** A repository is an abstract class in `core/*/repositories/`, and Nest uses it as the injection token. `InfraModule` (global, so `core` never imports it) binds it to an implementation: a Prisma repository in `infra/prisma/` (`PrismaService` connects as `nearby_main`, see [database access](database-access.md)). Moving a repository to the database changes only its binding in `infra.module.ts`. A module's repositories touch only its own tables (HLD I2).
8. **Inside a module, subfolders group files by kind** (`controllers/`, `schemas/`, `repositories/`, `services/`, `types/`). A subfolder is created only when its first file appears.
9. **A module's exported services are its public API** (HLD I2). Everything outside the module, whether a controller, another module, a job handler or the import service, calls only the services its Nest module exports, and may import its `types/`. Its repositories stay private.
10. **Relative imports name the `.ts` file.** `tsc` rewrites them to `.js` in `dist/` (`rewriteRelativeImportExtensions`). Imports used only as types are written `import type` (`verbatimModuleSyntax`).
11. **ESLint enforces rules 1, 7 and 9** with `no-restricted-imports` in `eslint.config.mjs`.
12. **Abstract classes only where `core` depends on something outside it.** Nest injects by class, since TypeScript interfaces do not exist at runtime: an abstract class is both the interface and the injection token. Repositories (rule 7) and the adapters of HLD I5 (rule 13) are abstract classes owned by `core`. Services are injected as concrete classes, by `api` and by other modules alike; a service gets an abstract class only when it needs a second implementation. An injected class is a value import, not `import type`, because the class is the token. In tests, a service is replaced with `{ provide: EventsService, useValue: fake }`, the fake typed as `Pick<EventsService, …>`.

13. **External services** follow the same pattern: the adapter interfaces of HLD I5 (`PushProvider`, `MessagingProvider`, `GoogleIdTokens`, `EventProvider`) are defined in `core` and implemented in `infra`. `EventProvider`, `MessagingProvider`, `GoogleIdTokens` and `JobQueue` exist; `PushProvider` comes with notifications.

14. **Transactions across modules** (HLD I2, I3) are explicit. A service starts one with `TransactionRunner.run(async (tx) => …)` (an abstract class in `core/common`, implemented with Prisma in `infra/prisma/`) and passes `tx` to every repository method, `notify(…, tx)` and `JobQueue.enqueue(…, tx)` that must join it. A repository method that can join takes `tx?: Transaction` and uses `tx ?? this.prisma`. Details: [database access](database-access.md#transactions). `@nestjs-cls/transactional` (implicit, no `tx` parameter) was considered and not adopted: an explicit `tx` keeps every transaction visible in signatures and needs no request context in job handlers.
13. **External services** follow the same pattern: the adapter interfaces of HLD I5 (`PushProvider`, `MessagingProvider`, `GoogleIdTokens`, `EventProvider`, `Geocoder`) are defined in `core` and implemented in `infra`. `EventProvider`, `Geocoder`, `MessagingProvider` and `GoogleIdTokens` exist; `PushProvider` comes with notifications. The import runs several `EventProvider`s, injected as one array under the `EVENT_PROVIDERS` token, since an array has no class to serve as the token.

## Planned

15. **Remove `infra/stubs/`** once the unit test of the import catalog no longer needs it.
16. **`src/import/`**: the import service (CMP-03) starts its own `core` module and `ImportInfraModule` without HTTP (`NestFactory.createApplicationContext`), and without the API's `InfraModule`: it connects as `nearby_import` and needs no key file. `npm run import:events` makes one run; the schedule (`import.run`, HLD I3) is still to come.

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
