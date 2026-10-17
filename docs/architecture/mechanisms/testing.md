# Testing

## Decision

Two test layers, each aimed at what the other cannot reach cheaply. Coverage measures only code that makes decisions when it runs: declarations run once on import and show 100% whether or not a test checks them.

## Rules

1. **Unit tests** (`tests/unit/`) check business rules in `src/core/` and adapters with logic, with mocked ports. They take what an HTTP request cannot set up reliably: time limits, races, data errors and pure functions.
2. **Integration tests** (`tests/e2e/`, despite the name) start the API and call it over HTTP, through every layer and the real database. They check the HTTP contract: status codes, validation, access and response bodies.
3. **Coverage scope** — measured:

   | Category | Files |
   |---|---|
   | Business rules | `core/*/services/`, `core/common/kyiv-time.ts` |
   | HTTP behaviour | `api/common/`: `endpoint.ts`, `auth.ts`, `api-exception.filter.ts`, `api-express-adapter.ts`, `security-headers.ts` |
   | Controllers | `api/*/controllers/` |
   | Adapters | `infra/auth/`, `infra/prisma/` |

   Left out:

   | Category | Files | Why |
   |---|---|---|
   | Generated code | `infra/prisma/generated/` | Not ours |
   | Types | `**/types/`, `core/common/page.ts` | Erased when compiled |
   | Ports | `core/*/repositories/`, `core/*/adapters/` | Empty abstract classes |
   | Temporary stand-ins | `infra/stubs/`, `infra/messaging/console-messaging-provider.ts` | Replaced by the database and the Telegram gateway |
   | Wiring and start-up | `*.module.ts`, `api/main.ts`, `api/common/config.ts` | Dependency injection and environment; run whenever the app starts |
   | Declarations | `api/*/schemas/`, `api/common/schemas/`, `routes.ts`, `tags.ts`, `registry.ts`, `domain-error.ts`, `api-exception.ts` | Run on import |
   | Tooling | `api/common/openapi.ts`, `scripts/` | Generates the spec; CI checks it is up to date |

4. **Left out is not untested.** Validation rules in schemas still get tests; coverage cannot show whether they have them.
5. **Categories, not file names.** A new file falls under its category; a file that fits none is measured. The patterns are in [`mcr.config.mjs`](../../../mcr.config.mjs).
6. **Two reports** — unit tests alone and all tests, as single HTML files in [`docs/testing/coverage/`](../../testing/coverage/), regenerated with `npm run docs:coverage` in the pull request that changes tests.

## AI Usage Note

Drafted with Claude from a discussion led by Viktoriia Baran.
