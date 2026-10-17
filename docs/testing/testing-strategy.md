# Testing Strategy

How Nearby is tested today and how testing will grow. Requirement IDs refer to [`requirements.md`](../requirements/requirements.md); the test layers and coverage scope are defined in the [testing mechanism](../architecture/mechanisms/testing.md).

## Current Status

| Layer | Where | Tests |
|---|---|---|
| Unit | [`tests/unit/`](../../tests/unit/): services, repositories mocked | 14 |
| Integration | [`tests/e2e/`](../../tests/e2e/): the API over HTTP with PostgreSQL and the stubs | 99 |
| End-to-end | through the Expo client | planned |

`tests/e2e/` holds what are really integration tests; we keep the folder name.

Unit tests cover events (FR-010, FR-011), verification codes and sign-in (FR-005, SEC-008, FR-001) and listings (FR-021). Integration tests send valid and invalid requests to every endpoint, including the token cases of SEC-005. We are integration-heavy because most of the API is validation and permissions, visible only over HTTP; matching, the core business logic, is not built yet, and most new unit tests will come with it.

Tools: `node:test`, MCR (monocart-coverage-reports), Docker PostgreSQL. Planned: k6, fast-check, Stryker, Maestro or Detox for the Expo client.

## Coverage

MCR, 17 October 2026 ([all tests](coverage/all/index.html), [unit tests](coverage/unit/index.html)):

| Run | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| All tests | 93.18% | 77.55% | 96.75% | 92.06% |
| Unit tests only | 16.84% | 10.61% | 9.09% | 10.81% |

Unit tests reach only `core/`; controllers, `api/common/` and `infra/` are covered by the integration tests alone. MAIN-001 asks for 70% overall, which is met, and 85% for matching, authorization guards and the report/ban flow, measured once those are built.

Not covered, and why:
- **`api-express-adapter.ts` (33%)** maps Express errors (invalid JSON, body too large, malformed URL); no test sends such a request yet. Next integration test to add.
- **`key-files.ts` (79%)** fails fast on a missing or malformed key file at start-up; these branches need unit tests.
- **Branches (77.55%)** lag mostly in `infra/prisma/` (44%), the database error paths, and in `api-exception.filter.ts` (57%).

## Integration, System and Acceptance Tests

- **Integration:** every stub repository replaced by Prisma gets tests against PostgreSQL; new endpoints join `tests/e2e/`.
- **System:** core flows through the Expo client against a running API.
- **Acceptance:** each acceptance criterion in [`user-stories.md`](../requirements/user-stories.md) becomes a scenario traced in [`rtm.md`](../requirements/rtm.md); US-001–004 and US-010 now, the rest as they are built.

## Performance, Security and Property-Based Testing

- **Performance:** k6 for PERF-001 (500 sessions, p95 ≤ 1 s) and, with matching, PERF-003.
- **Security:** `npm audit` already runs in CI (SEC-006); authorization tests for every match state (SEC-001).
- **Property-based:** fast-check on `match(pool, exclusions, seed)`: every pairing is mutual and no user is paired twice in a round (FUNC-002).

## CI/CD

[`ci.yml`](../../.github/workflows/ci.yml) runs lint, type checks, the spec check, `npm audit` and the integration tests in one job, without unit tests or coverage. Actions are paused: the organization's minutes ran out. Once the self-hosted runner works, every pull request will run `npm run test:coverage` with a gate just below the current coverage, so any drop fails the build; the gate rises as coverage grows.

Tests run locally before pushing, review checks them with the diff, and a flaky test is fixed, not skipped.

## AI Usage Note

Drafted with Claude Code from the repository's tests, CI workflow and requirements; edited and reviewed by Daryna Halytska. Coverage numbers come from a local run and match the committed reports.