# Testing Strategy

How Nearby is tested today and how testing will grow. Requirement IDs refer to [`requirements.md`](../requirements/requirements.md).

## Current Status

| Layer | Where | Tests |
|---|---|---|
| Unit | [`tests/unit/`](../../tests/unit/): services and schemas, repositories mocked | 14 |
| Integration | [`tests/e2e/`](../../tests/e2e/): the API over HTTP with PostgreSQL and the stubs | 99 |
| End-to-end | through the Expo client | planned |

`tests/e2e/` holds what are really integration tests; we keep the folder name.

Unit tests cover event validation and cancellation (FR-010, FR-011), verification codes and sign-in (FR-005, SEC-008, FR-001) and listing rules (FR-021). Integration tests send valid and invalid requests to every endpoint, including the token cases of SEC-005.

We are integration-heavy because most of the API is validation and permissions, visible only over HTTP. Matching, the core business logic, is not built yet; most new unit tests will come with it.

Tools: `node:test`, c8, Docker PostgreSQL. Planned: k6, fast-check, Stryker, and Maestro or Detox for end-to-end tests of the Expo client.

## Coverage

Unit + integration tests, 17 October 2026: **90.5% statements, 84.75% branches, 91.46% functions** (generated Prisma client excluded). Unit tests alone reach 18%; the rest comes from the integration tests, the only ones that reach controllers, `infra/` and the stubs.

Not covered, and why:
- **`api-express-adapter.ts` (46%)** maps Express errors (invalid JSON body, body too large, malformed URL) to our error format. No test sends such a request yet; this is the next integration test to add.
- **`key-files.ts` (75%)** fails fast on a missing or malformed key file at start-up; these branches need unit tests.
- **`openapi.ts` (57%)** runs from `npm run docs:generate`; CI checks the generated spec instead.
- **`core/*/types/` (0%)** are type-only files with no runtime code. They should be excluded from coverage together with the generated Prisma client; `.c8rc.json` excludes neither yet.

| Target (MAIN-001) | Statements | Status |
|---|---|---|
| Whole API | 70% | met |
| Matching, authorization guards, report/ban flow | 85% | measured once matching and moderation are built |

## Integration, System and Acceptance Tests

- **Integration:** every stub repository replaced by Prisma gets tests against PostgreSQL; new endpoints join `tests/e2e/`.
- **System:** core flows through the Expo client against a running API.
- **Acceptance:** each acceptance criterion in [`user-stories.md`](../requirements/user-stories.md) becomes a scenario traced in [`rtm.md`](../requirements/rtm.md); US-001–004 and US-010 now, the rest as they are built.

## Performance, Security and Property-Based Testing

- **Performance:** k6 for PERF-001 (500 sessions, p95 ≤ 1 s) and, with matching, PERF-003.
- **Security:** `npm audit` already runs in CI (SEC-006); authorization tests for every match state (SEC-001).
- **Property-based:** fast-check on `match(pool, exclusions, seed)`: every pairing is mutual and no user is paired twice in a round (FUNC-002).

## CI/CD

[`ci.yml`](../../.github/workflows/ci.yml) runs lint, type checks, the spec check, `npm audit` and the integration tests in one job; no unit tests or coverage yet. Actions are paused because the organization's minutes ran out. Once the self-hosted runner works, `npm run test:coverage` will run on every pull request with a coverage gate (`c8 --check-coverage`) set just below the current coverage, so any drop fails the build; the gate rises as coverage grows.

Tests are run locally before pushing, review checks them with the diff, and a flaky test is fixed, not skipped.

## AI Usage Note

Drafted with Claude Code from the repository's tests, CI workflow and requirements; edited and reviewed by Daryna Halytska. Coverage numbers come from a local run.