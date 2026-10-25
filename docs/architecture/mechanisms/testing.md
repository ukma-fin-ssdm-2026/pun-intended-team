# Testing

## Decision

Two test layers, each aimed at what the other cannot reach cheaply. Coverage measures only code that makes decisions when it runs: declarations run once on import and show 100% whether or not a test checks them.

## Rules

1. **Unit tests** (`tests/unit/`) check business rules in `src/core/` and adapters with logic, with mocked ports. They take what an HTTP request cannot set up reliably: time limits, races, data errors and pure functions.
2. **Integration tests** (`tests/e2e/`, despite the name) start the API and call it over HTTP, through every layer and the real database. Each run drops and creates a database of its own, `<database>_e2e`, migrates and seeds it, so no run sees rows of another. They check the HTTP contract: status codes, validation, access and response bodies.
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
   | Wiring and start-up | `*.module.ts`, `api/main.ts`, `import/main.ts`, `api/common/config.ts` | Dependency injection and environment; run whenever the app starts |
   | Declarations | `api/*/schemas/`, `api/common/schemas/`, `routes.ts`, `tags.ts`, `registry.ts`, `domain-error.ts`, `api-exception.ts` | Run on import |
   | Tooling | `api/common/openapi.ts`, `scripts/` | Generates the spec; CI checks it is up to date |

4. **Left out is not untested.** Validation rules in schemas still get tests; coverage cannot show whether they have them.
5. **Categories, not file names.** A new file falls under its category; a file that fits none is measured. The patterns are in [`mcr.config.mjs`](../../../mcr.config.mjs).
6. **Thresholds** — a run of all tests (`npm run test:coverage`, in CI) fails below 90% of lines or 80% of branches. The unit report alone has no threshold. Coverage is raised with tests, not by leaving files out.
7. **Two reports** — unit tests alone and all tests, as single HTML files in [`docs/testing/coverage/`](../../testing/coverage/), regenerated with `npm run docs:coverage` in the pull request that changes tests.

### Writing a unit test

8. **Layout** — one file per unit, named after it: `tests/unit/auth.service.test.ts`. The code under test and its types come from `dist/`, since Node cannot run the decorators in `src/`; the build writes declaration files next to the code. [`tests/tsconfig.json`](../../../tests/tsconfig.json) type-checks the tests. Values and builders shared by several files live in `tests/unit/fixtures/`; a fixture used by one file stays in it. A test file never imports another test file.
9. **Inside a test file**, in this order: imports (`node:` modules, code from `dist/`, types from `src/`, fixtures), constants, builders, the mock factory `makeService()`, then one `describe` per method. Builders are named `aX()` or `anX()`, return the ordinary case and take overrides; a test overrides only what it is about, so the case it checks is visible in the test.
10. **Test data by layer:**

   | Code | Test data |
   |---|---|
   | Services | Every port mocked with `mock.fn` from `node:test`, built by one factory per service; a test changes only the mocks it needs |
   | Pure functions | A table of inputs and expected results, one test per row |
   | Adapters | The real implementation with test inputs, such as keys in a temporary folder; the library it wraps is not mocked |

11. **Deterministic** — fixed ids and dates from the fixtures, never `Date.now()` or random values in test data. Code that reads the clock runs under `mock.timers` with a fixed `now`, reset after each test. The exception is a property-based test (fast-check), which makes up its inputs on purpose; a failing run prints its seed, which replays it.
12. **One behaviour per test** — `describe` names the unit or method (`AuthService.verify`), `test` names the behaviour in lower case: `'rejects a code issued more than 10 minutes ago'`. Arrange, act and assert are separated by blank lines. A table of cases covers one path with different inputs, not unrelated behaviours. A test for a requirement names its id in a comment, e.g. `// SAFE-001`.
13. **Assert what a caller observes** — the returned value, the `DomainError` code (`assert.rejects` with a check of `code`), and the port calls with their arguments, including that nothing was saved when a rule fails. Expected values come from the arranged data (`credential.role`) or from a named constant for a value a requirement sets (`ACCESS_TOKEN_SECONDS`, SEC-005), not from repeated literals. Never assert a mock returning what it was given, or only that no error was thrown.

## AI Usage Note

Drafted with Claude from a discussion led by Viktoriia Baran.
