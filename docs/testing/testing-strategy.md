# Testing Strategy

How Nearby is tested today and how testing will grow. Requirement IDs refer to [`requirements.md`](../requirements/requirements.md); the test layers and coverage scope are defined in the [testing mechanism](../architecture/mechanisms/testing.md).

## Current Status

| Layer | Where | Tests |
|---|---|---|
| Unit | [`tests/unit/`](../../tests/unit/): services, schemas, date functions and auth adapters; repositories mocked | 134 |
| Integration | [`tests/e2e/`](../../tests/e2e/): the API over HTTP with PostgreSQL and the stubs | 99 |
| End-to-end | through the Expo client | planned |

`tests/e2e/` holds what are really integration tests; we keep the folder name.

Unit tests cover the event catalog and its window (FR-006, FR-007, FR-009 to FR-011), registration, sign-in and its lockout (FR-001, FR-005, SAFE-001, SEC-007, SEC-008), listings (FR-021), Kyiv dates and ages, the match score, and the auth adapters: key files, code hashes and access tokens (SEC-005). They take what HTTP cannot set up reliably: time limits, races and data errors. Integration tests send valid and invalid requests to the endpoints, including the token cases of SEC-005; most of the API is validation and permissions, visible only over HTTP. Matching, the core business logic, is not built yet, and most new unit tests will come with it.

Tools: `node:test`, MCR (monocart-coverage-reports), fast-check, Docker PostgreSQL. Planned: k6, Stryker, Maestro or Detox for the Expo client.

## Coverage

MCR, 17 October 2026 ([all tests](coverage/all/index.html), [unit tests](coverage/unit/index.html)):

| Run | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| All tests | 95.33% | 86.06% | 96.79% | 95.07% |
| Unit tests only | 40.65% | 47.01% | 30.77% | 29.36% |

Unit tests reach `core/` and `infra/auth/`; controllers, `api/common/` and the database code are covered by the integration tests alone. MAIN-001 asks for 70% overall, which is met, and 85% for the critical modules: the authorization guards (`api/common/auth.ts`) are at 94%; matching and the report/ban flow are measured once they are built.

Not covered, and why:
- **`api-express-adapter.ts` (33%)** maps Express errors (invalid JSON, body too large, malformed URL); no test sends such a request yet. Next integration test to add.
- **`auth.ts` (94%)**: no test calls an admin endpoint with a signed-in user who is not an admin, so the check that answers `404` (lines 44–46) never runs. Next integration test to add, since the guards are a critical module.
- **`prisma-categories.repository.ts` (77%, branches 43%)**: name clashes, deleting a category in use and the race the unique index stops have no tests yet.
- **`api-exception.filter.ts` (branches 57%)**: the `500` for an unexpected error and the mapping of Nest's own `403`.
- **Production and start-up only**: HSTS in production, a missing `DATABASE_URL`, a malformed stored password hash; these need another environment or a broken dependency.

## Integration, System and Acceptance Tests

- **Integration:** every stub repository replaced by Prisma gets tests against PostgreSQL; new endpoints join `tests/e2e/`.
- **System:** core flows through the Expo client against a running API.
- **Acceptance:** each acceptance criterion in [`user-stories.md`](../requirements/user-stories.md) becomes a scenario traced in [`rtm.md`](../requirements/rtm.md); US-001–004 and US-010 now, the rest as they are built.

## Performance, Security and Property-Based Testing

- **Performance:** k6 for PERF-001 (500 sessions, p95 ≤ 1 s) and, with matching, PERF-003.
- **Security:** `npm audit` already runs in CI (SEC-006); authorization tests for every match state (SEC-001).
- **Property-based:** fast-check already checks the sign-in lockout (see Bonuses); next, `match(pool, exclusions, seed)`: every pairing is mutual and no user is paired twice in a round (FUNC-002).

## CI/CD

[`ci.yml`](../../.github/workflows/ci.yml) runs lint, formatting and type checks, the spec check, `npm audit` and the integration tests in one job, without unit tests or coverage. Actions are paused: the organization's minutes ran out. Once the self-hosted runner works, every pull request will run `npm run test:coverage` with a gate just below the current coverage, so any drop fails the build; the gate rises as coverage grows.

Tests run locally before pushing, review checks them with the diff, and a flaky test is fixed, not skipped.

## Bonuses

### Property-based test

[`sign-in-lockout.test.ts`](../../tests/unit/sign-in-lockout.test.ts), "for any sequence of failed sign-ins": fast-check generates up to 50 failed sign-ins with 0 to 60 minutes between them, 100 timelines per run, and after every failure checks that the state `afterFailedSignIn` returns is one the database accepts: the count is 0 exactly when there is no window start (`accounts_failed_signins_window_check`), and it stays below 5 (SEC-007).

**Why it holds for any input.** `afterFailedSignIn` returns only two kinds of state: the 5th failure gives "locked, nothing counted"; any other failure gives "counting, with a window start", since the first failure sets the start and later ones keep it. Neither kind has a count without a start or a count of 5.

**Evidence.** With the code before the window start was set (the cycle 2 `[GREEN]` of #208), the property fails on the first timeline, and fast-check shrinks it to a single failure at minute 0: `Counterexample: [[0]]`, the row the constraint rejects. The current code passes.

## AI Usage Note

Drafted with Claude Code from the repository's tests, CI workflow and requirements; edited and reviewed by Daryna Halytska. Coverage numbers come from a local run and match the committed reports.