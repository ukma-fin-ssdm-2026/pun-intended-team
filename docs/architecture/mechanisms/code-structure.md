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
    common/                     domain-error.ts, kyiv-time.ts, page.ts
    catalog/
      catalog.module.ts         provides + exports EventsService, CategoriesService
      repositories/             events, categories, venues, organizations (abstract: what core needs from storage)
      services/                 events.service.ts, categories.service.ts
      types/                    event, category, venue, organization
  infra/                        data access and external services
    infra.module.ts             binds every repository to its implementation
    stubs/                      stand-in for the database, deleted as one folder: one repository per core repository, data.ts, paginate.ts
  scripts/                      generate-spec.ts (npm run docs:generate)
  mcp/                          MCP server generated from the spec; a separate Node project, not edited by hand
```

## Rules

1. **`api` → `core` ← `infra`.** `core` imports nothing from either: `api` calls its services, and `infra` implements its repositories. `api/app.module.ts` brings all three together.
2. **Controllers only deal with HTTP.** A controller declares the endpoint with `@Endpoint`, receives the validated input, calls a service and returns its result. It contains no business rules.
3. **Business logic lives in `core` services**, including calculations. For example, each module exposes `stats()` in its own service, and admin stats only combine them.
4. **A module with endpoints has two Nest modules.** The `core` module (`CatalogModule`) provides and exports the services. The `api` module (`CatalogApiModule`) imports it and declares the controllers.
5. **API schemas are separate from domain types.** `api/*/schemas/` holds the zod request and response schemas: the DTOs, and the source of the OpenAPI spec. `core/*/types/` holds plain TypeScript entities together with service inputs. Controllers may return domain objects: `@Endpoint` parses every success response with its schema, so fields the schema does not declare (internal or sensitive ones) never reach the client. Request body schemas are the opposite: `z.strictObject`, so an unknown field is a `400`.
6. **`core` errors carry a code, not a status.** `core` throws `DomainError` with a code (`NOT_FOUND`, `CONFLICT`, one code per business rule). `api` maps each code to a status (`api-exception.ts`), and `ApiExceptionFilter` is the only place that builds `ErrorResponse`. Codes that only HTTP raises (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL_ERROR`) stay in `api`. Statuses are listed in [api-design.md](../../api/api-design.md).
7. **Services reach storage only through repositories.** A repository is an abstract class in `core/*/repositories/`, and Nest uses it as the injection token. `InfraModule` (global, so `core` never imports it) binds it to an implementation: the stub now, Prisma later. A module's repositories touch only its own tables (HLD I2).
8. **Inside a module, subfolders group files by kind** (`controllers/`, `schemas/`, `repositories/`, `services/`, `types/`). A subfolder is created only when its first file appears.
9. **A module's exported services are its public API** (HLD I2). Everything outside the module, whether a controller, another module, a job handler or the import service, calls only the services its Nest module exports, and may import its `types/`. Its repositories stay private.
10. **Relative imports name the `.ts` file.** `tsc` rewrites them to `.js` in `dist/` (`rewriteRelativeImportExtensions`). Imports used only as types are written `import type` (`verbatimModuleSyntax`).
11. **ESLint enforces rules 1, 7 and 9** with `no-restricted-imports` in `eslint.config.mjs`.
12. **Abstract classes only where `core` depends on something outside it.** Nest injects by class, since TypeScript interfaces do not exist at runtime: an abstract class is both the interface and the injection token. Repositories (rule 7) and the adapters of HLD I5 (rule 14) are abstract classes owned by `core`. Services are injected as concrete classes, by `api` and by other modules alike; a service gets an abstract class only when it needs a second implementation. An injected class is a value import, not `import type`, because the class is the token. In tests, a service is replaced with `{ provide: EventsService, useValue: fake }`, the fake typed as `Pick<EventsService, …>`.

## Planned

13. **Database:** `infra/prisma/` gets a `PrismaService` (connecting as `nearby_main`, see [database access](database-access.md)) and one Prisma implementation per repository. Switching means changing the bindings in `infra.module.ts` and deleting `infra/stubs/`.
14. **External services** follow the same pattern: the adapter interfaces of HLD I5 (`PushProvider`, `MessagingProvider`, `GoogleIdentity`, `EventProvider`) are defined in `core` and implemented in `infra`.
15. **Transactions across modules** (HLD I2, I3: `notify(…, tx)`, jobs enqueued in the same transaction) via `@nestjs-cls/transactional` with its Prisma adapter, so repositories join the caller's transaction without passing `tx` around.
16. **`src/import/`**: the import service (CMP-03) starts `core` and `infra` without HTTP (`NestFactory.createApplicationContext`).

## AI Usage Note

Drafted with Claude from an architecture discussion led by Viktoriia Baran.
