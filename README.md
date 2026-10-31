# Nearby

[![CI](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml/badge.svg)](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml)

Team project for the SSDM course at the National University of Kyiv-Mohyla Academy, 2026

## ꩜ Project description

Nearby is a particularly whimsical mobile app for going to events and meeting new people along the way.

The app collects all the upcoming events in a city: films, exhibitions, concerts, protests or workshops — anything one may need company for. A user fills in a profile (interests, age, what they are looking for: friends, dating, or just company for the evening), picks an event they would like to attend, and gets matched with someone who wants to go to the same event and shares the most interests. Users can also propose their own events if one isn't already listed.

Instead of matching first and looking for something to do second, the event is what brings people together.

Look [here](Project-Description.md) for a more detailed project description

## ໑ Team

| Member | Role | GitHub |
|---|---|---|
| Viktoriya Baran | Repo Maintainer, Quality Lead, Architecture Lead, Backend Lead, API Design Lead, Documentation Lead, Testing Lead, Quality Analyst, Release Manager | [@viktoriyabaran](https://github.com/viktoriyabaran) |
| Daryna Halytska | Documentation Lead, Project Brief Lead, Data & Threat Modeler, Documentation Lead (API), Security Analyst, Testing Strategist, Test Planner, Test Engineer | [@DarynaHalytska](https://github.com/DarynaHalytska) |
| Oleh Moshenskyi | Issue Tracker Lead, Requirements Lead, FR Lead, Requirements-Architecture Mapper, Quality Lead (API), Code Reviewer, Prototype Lead, Debugging Lead, Documentation Owner, Refactoring Lead | [@OLEGkn-coder](https://github.com/OLEGkn-coder) |
| Vladyslav Redchuk | CI Maintainer, Traceability Lead, UML Lead, Integration Lead, Quality Lead (code), Review Manager, AI Code Reviewer, Code Analyst and Security | [@Vlad-Re](https://github.com/Vlad-Re) |

More on the team and our principles can be found [here](TeamCharter.md).

## ୭ Requirements Artifacts

Documentation related to requirements engineering for this project is located [here](docs/requirements/):

- [`requirements.md`](docs/requirements/requirements.md) — functional and non-functional requirements
- [`user-stories.md`](docs/requirements/user-stories.md) — user stories with acceptance criteria
- [`rtm.md`](docs/requirements/rtm.md) — Requirements Traceability Matrix
- [`use-cases.md`](docs/requirements/use-cases.md) — use case descriptions

## ໒ Architecture Artifacts

Documentation related to system architecture for this project is located [here](docs/architecture/):

- [`high-level-design.md`](docs/architecture/high-level-design.md) — architecture style, components and their interactions
- [`traceability-matrix.md`](docs/architecture/traceability-matrix.md) — requirements-to-components mapping
- [`data-model.md`](docs/architecture/data-model.md) — ER / domain model
- [`threat-model.md`](docs/architecture/threat-model.md) — STRIDE threat model
- [`decisions/`](docs/architecture/decisions/) — Architecture Decision Records (ADRs)
- [`mechanisms/`](docs/architecture/mechanisms/) — architectural and code mechanisms
- [`uml/`](docs/architecture/uml/) — UML diagrams (component, main server components, sequence, deployment, data model) with rendered SVGs in `rendered/`. Render them with `npm run docs:diagrams` (needs Docker).

## ൭ API Documentation

The REST API (NestJS) is Code-First: the OpenAPI spec is generated from the zod schemas in [`src/api/`](src/api/).

- [Swagger UI on GitHub Pages](https://ukma-fin-ssdm-2026.github.io/pun-intended-team/) — read-only docs, published from `main` on every push; the page itself is [`docs/api/index.html`](docs/api/index.html), with Swagger UI vendored in [`docs/api/vendor/swagger-ui/`](docs/api/vendor/swagger-ui/)
- [`openapi-generated.yaml`](docs/api/openapi-generated.yaml) — the generated spec the page shows; regenerate and commit it with `npm run docs:generate` after changing the API
- The `CI` workflow regenerates the spec and fails a pull request whose committed spec is out of date
- Local Swagger UI with "Try it out": run `npm run dev` and open http://localhost:4100/api-docs. Get a token from an Auth endpoint, click **Authorize** and paste it; see [Trying It Out](docs/api/api-design.md#trying-it-out)
- [`api-design.md`](docs/api/api-design.md) — resource model, endpoints, status codes, error format and versioning
- [`quality-attributes.md`](docs/api/quality-attributes.md) — quality goals for the Nearby REST API

## ⟡ Code Quality

Documentation related to code quality for this project is located [here](docs/code-quality/):

- [`static-analysis.md`](docs/code-quality/static-analysis.md) — manual security review of the API code, security analyzer results and dependency audit
- [`review-report.md`](docs/code-quality/review-report.md) — code review of the Whadio team's project
- [`review-response.md`](docs/code-quality/review-response.md) — how we handled the review of our code
- [`progress.md`](docs/code-quality/progress.md) — implementation progress of the prototype

## ര Running the API

Requires Node.js 26 or later.

```bash
npm install
cp .env.example .env    # first time only: it overwrites an existing .env
npm run keys:generate   # key files for tokens, verification codes and contact encryption in keys/, never committed; keeps existing ones
npm run dev             # http://localhost:4100, Swagger UI at /api-docs; restarts on changes
```

For a production build: `npm run build`, then `npm start`.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4100` | Port the server listens on |
| `NODE_ENV` | — | `production` stops writing the spec on startup and hides Swagger UI |
| `SWAGGER_UI` | — | `true` serves Swagger UI in production too, e.g. on staging |
| `CORS_ORIGINS` | — | Comma-separated origins allowed to call the API from a browser, e.g. `http://localhost:8081` for the Expo web client; unset keeps CORS off |
| `DATABASE_URL` | — | PostgreSQL connection string of the schema owner, used by migrations and `npm run db:set-passwords`, set in `.env.example`, see [Local database](#local-database) |
| `MAIN_DATABASE_URL` | — | Connection string of the `nearby_main` role the API runs with, set in `.env.example`; the server does not start without it |
| `IMPORT_DATABASE_URL` | — | Connection string of the `nearby_import` role for the import service, set in `.env.example`; only `npm run db:set-passwords` reads it for now |
| `JWT_KEYS_FILE` | — | Keys that sign access tokens, created by `npm run keys:generate`; the server does not start without it |
| `CODE_HMAC_KEY_FILE` | — | Key that hashes verification codes, created by `npm run keys:generate`; the server does not start without it |
| `CONTACT_HMAC_KEY_FILE` | — | Key that hashes phone numbers to look accounts up by, created by `npm run keys:generate`; the server does not start without it. Losing or changing it fails without an error: existing accounts are no longer found, and their numbers can register a second account |
| `DATA_ENCRYPTION_KEY_FILE` | — | Key that encrypts phone numbers and dates of birth in the database (SEC-003), created by `npm run keys:generate`; the server does not start without it. Losing or changing it makes the stored values unreadable |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `20` | Requests a minute per IP to each Google sign-in and registration endpoint and to `refresh` (SEC-007) |
| `TRUST_PROXY` | — | The reverse proxy whose `X-Forwarded-For` the per-IP limits trust: a hop count, `loopback`, `uniquelocal` or CIDRs; `true` is refused. Unset without a proxy; staging sets `uniquelocal` |
| `GOOGLE_CLIENT_IDS` | — | Comma-separated client ids of every Google OAuth client the app signs in with (web, iOS, Android); unset turns Google sign-in off, which production refuses |
| `MESSAGING_PROVIDER` | `disabled` in production, `console` otherwise | How verification codes go out: `disabled`, `console` (logged, refused in production) or `telegram`. No route sends codes while sign-in is Google-only ([ADR-004](docs/architecture/decisions/ADR-004.md)) |
| `TELEGRAM_GATEWAY_TOKEN`, `TURBOSMS_TOKEN`, `TURBOSMS_SENDER` | — | Telegram Gateway and its SMS fallback, read only with `MESSAGING_PROVIDER=telegram` ([external services](docs/operations/external-services.md)) |
| `ALLOW_TEST_ADAPTERS` | `false` | `true` lets production use test stand-ins; only the e2e tests set it |

The two database keys, `CONTACT_HMAC_KEY_FILE` and `DATA_ENCRYPTION_KEY_FILE`, cannot be created again: every database needs its own pair, backed up outside the repository and the server, for example in the team vault. Locally, new keys mean a new database: `docker compose down -v`, then the [Local database](#local-database) commands.

Other scripts: `npm run typecheck` checks types without building, `npm run lint` and `npm run format` run ESLint and Prettier, and `npm run docs:generate` regenerates [`openapi-generated.yaml`](docs/api/openapi-generated.yaml).

Before the first commit, enable the commit message hook: `git config core.hooksPath .githooks`. The coding standard and review rules are in [§5 of the charter](TeamCharter.md#5-code-quality-and-review-policy).

### Event import

The import service (CMP-03, FR-008) takes the events of one external provider into the catalog. It is a separate start command, not part of the API: [`src/import/`](src/import/) loads the import module [`src/core/import/`](src/core/import/) and its bindings in [`ImportInfraModule`](src/infra/import-infra.module.ts). The provider sits behind the `EventProvider` adapter, and [`ConcertUaEventProvider`](src/infra/providers/concert-ua-event-provider.ts) is bound to it; a second provider is a new class and a changed line there (FLEX-003). Until Concert.ua gives us access, the adapter reads a sample feed. A record that cannot be mapped is skipped and logged (FR-015), and a second run changes only what the provider changed.

```bash
npm run import:events   # one run: fetch, normalize, save, print a report; needs .env, the keys and the local database
```

Events are still kept in memory, so the API does not see what a run imported until events are in the database. Until then, the unit tests check that the catalog serves imported events (`tests/unit/event-import.catalog.test.ts`).

<a id="tests"></a>

## ꕤ Tests

### Running tests

Unit tests in [`tests/unit/`](tests/unit/) check the services in `src/core/` with mocked repositories. The tests in [`tests/e2e/`](tests/e2e/) are integration tests, despite the folder name: they start the API and call it over HTTP, through every layer and the real database. They need `.env` and the [local database](#local-database). Every command builds first, since the tests import the compiled code from `dist/`.

```bash
npm run test:unit            # unit tests
npm run test:e2e             # integration tests
npm run test:coverage:unit   # unit tests with coverage
npm run test:coverage        # all tests with coverage
npm run docs:coverage        # regenerates the committed reports in docs/testing/coverage/
```

The coverage commands use [monocart-coverage-reports](https://github.com/cenfun/monocart-coverage-reports), print a summary and write a single-file HTML report to `coverage/index.html`, which is not committed. Coverage measures only code that makes decisions when it runs; what is left out and why is in the [testing mechanism](docs/architecture/mechanisms/testing.md). Blank and comment lines are not counted.

The committed reports, [unit tests](docs/testing/coverage/unit/index.html) and [all tests](docs/testing/coverage/all/index.html), are a snapshot: after changing tests, run `npm run docs:coverage` and commit `docs/testing/coverage/` in the same pull request.

How testing will grow, the current coverage and what is not covered yet are in the [testing strategy](docs/testing/testing-strategy.md).

The k6 load test [`tests/perf/listings.k6.js`](tests/perf/listings.k6.js) checks PERF-001 on `GET /api/v1/listings` at 500 concurrent sessions for 10 minutes: `npm run test:perf` runs it in Docker against the running API, with the access token of a Google sign-in in `PERF_TOKEN`.

### Test documentation

Documentation related to testing is located [here](docs/testing/), the test plan [here](docs/validation/):

- [`testing-strategy.md`](docs/testing/testing-strategy.md) — current test layers and counts, coverage and how testing will grow
- [`debugging-log.md`](docs/testing/debugging-log.md) — the Lab 6 debugging challenge: a planted bug found by the tests, fixed and guarded by a regression test
- [`coverage/`](docs/testing/coverage/) — committed coverage reports for the [unit tests](docs/testing/coverage/unit/index.html) and [all tests](docs/testing/coverage/all/index.html)
- [`test-plan.md`](docs/validation/test-plan.md) — scope, test levels, risks, test cases and exit criteria, with the k6 load test run (TC-10)
- [`review-log.md`](docs/validation/review-log.md) — the Lab 7 peer review of the test plan by Whadio, what we changed after it, and the review of an AI-generated pull request

<a id="commit-hooks"></a>

## 𓂀 Commit hooks

Every commit runs [pre-commit](https://pre-commit.com/) with the hooks from [`.pre-commit-config.yaml`](.pre-commit-config.yaml): [gitleaks](https://github.com/gitleaks/gitleaks) looks for secrets in the staged changes, Prettier formats `.ts` and `.mjs` files and ESLint checks them. If a hook changes a file, the commit stops: review the change, `git add` it and commit again.

Install pre-commit once per machine, with [pipx](https://pipx.pypa.io/stable/installation/) (`sudo apt install pipx` on Ubuntu, `brew install pipx` on macOS):

```bash
pipx install pre-commit
```

The hooks run through `.githooks/pre-commit`, which is enabled by the same `git config core.hooksPath .githooks` as above. Without pre-commit the commit is refused and the hook prints this command. The first run downloads gitleaks and takes longer. To check the whole repository: `pre-commit run --all-files`.

If a commit from VS Code fails with "pre-commit is not installed", restart VS Code after `pipx ensurepath`, so it picks up the new `PATH`.

<a id="local-database"></a>

## 𓊚 Local database

Categories, accounts, verification codes and sessions are stored in PostgreSQL ([ADR-002](docs/architecture/decisions/ADR-002.md)); the other data is still served from stubs. You need [Docker](https://docs.docker.com/get-docker/). The database settings are in `.env`, which `cp .env.example .env` creates.

```bash
docker compose up -d        # PostgreSQL 18 on 127.0.0.1:5432; wait until `docker compose ps` shows healthy
npx prisma migrate deploy   # creates the tables and the starting categories
```

Each process connects with its own database role ([database access](docs/architecture/mechanisms/database-access.md)): migrations run as the owner in `DATABASE_URL`, the API as `nearby_main` and the import service as `nearby_import`. The migration creates the two roles without a password; after `prisma migrate deploy`, run `npm run db:set-passwords` once to set the passwords from `MAIN_DATABASE_URL` and `IMPORT_DATABASE_URL` (repeating it is safe, and it prints no passwords). The owner needs the `CREATEROLE` privilege, which the Docker user already has.

`npm run test:e2e` never touches this database: it creates `<POSTGRES_DB>_e2e` next to it on every run, with keys of its own.

To reset the database, delete its data and migrate again: `docker compose down -v`, then the commands above and `npm run db:set-passwords`. After a change in [`prisma/schema.prisma`](prisma/schema.prisma), `npx prisma migrate dev --name <what-changed>` creates the migration; the client in `src/infra/prisma/generated/` is not committed and is rebuilt by `npm install` or `npx prisma generate`.

There are no development accounts: sign up with your own Google account in the app ([Google-only for now](docs/architecture/decisions/ADR-004.md)). To make an account an administrator, find it and set its role, then sign in again, since the role is part of the access token:

```sql
SELECT id, created_at FROM accounts ORDER BY created_at DESC LIMIT 5;
UPDATE accounts SET role = 'admin' WHERE id = '<id>';
```

## ൬ Running the client

The Expo client in [`app/`](app/) lists the catalog events and opens their details, in a browser or on a phone. To run it next to the API, see [`app/README.md`](app/README.md).

## ൠ MCP Server

[`src/mcp/`](src/mcp/) is an [MCP](https://modelcontextprotocol.io/) server, generated from the OpenAPI spec, that exposes the API endpoints as tools for AI agents such as Claude Code. [`.mcp.json`](.mcp.json) connects it to Claude Code as `nearby-api`. How to regenerate, run and connect it is described in [`AGENTS.md`](AGENTS.md#mcp-server).

## ༄ AI Usage Note

This README was written with the participation of Claude, which drafted the initial structure and wording. The draft was reviewed and edited by Daryna Halytska and Viktoriya Baran before being committed.

Claude later checked every link against the repository files, fixed broken section links and added links to the documents in `docs/` that were missing. Every link target was verified to exist; the changes were reviewed by Daryna Halytska.
