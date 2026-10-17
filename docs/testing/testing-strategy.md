# Testing Strategy

How Nearby is tested today and how testing will grow. Requirement IDs refer to [`requirements.md`](../requirements/requirements.md).

## Current Status

Tests run on the Node.js test runner (`node:test`); coverage is measured with [c8](https://github.com/bcoe/c8). Tests import the built code from `dist/`.

- **Unit** ([`tests/unit/`](../../tests/unit/), 14 tests, repositories mocked): event fields are validated (FR-010) and only the owner can cancel an event (FR-011); an expired code is rejected (FR-005, SEC-008) and sign-in issues a token with the account role (FR-001); a listing cannot be created for a cancelled event or deleted by anyone but its author (FR-021).
- **E2E** ([`tests/e2e/`](../../tests/e2e/), 88 tests): the built API runs against PostgreSQL, and every endpoint gets a valid request and its rejections over HTTP, including the bad-token cases (SEC-005) and code limits (SEC-008).

## Coverage Summary

Unit tests only, 17 October 2026: **18.06% statements, 23.3% branches, 15.74% functions, 18.06% lines**, generated Prisma client excluded. `.c8rc.json` must exclude `dist/infra/prisma/generated/`; that fix belongs to PR #199.

Uncovered: controllers, `infra/` and the stubs run only behind HTTP and are covered by the e2e tests, not by this run. Services have partial unit tests (profiles 39%, events 50%, listings 57%). Matching is not implemented yet, and notifications is a stub. TODO: unit + e2e numbers.

## Integration, System and Acceptance Tests

- **Integration:** each stub repository replaced by a Prisma one (ADR-002) gets tests against the Docker PostgreSQL.
- **System:** the e2e suite; every new endpoint (matching, notifications, reports, bans) is added to it.
- **Acceptance:** each acceptance criterion in [`user-stories.md`](../requirements/user-stories.md) becomes a named e2e scenario traced in [`rtm.md`](../requirements/rtm.md). US-001–004 and US-010 can be covered now; US-005–009 when built.

## Performance, Security and Property-Based Testing

- **Performance:** k6 for PERF-001 (500 sessions for 10 min, p95 ≤ 1000 ms) and, once matching exists, PERF-003 (50 users on one event, p90 ≤ 60 s).
- **Security:** `npm audit --audit-level=high` already runs in CI (SEC-006); SEC-001 gets authorization tests for every match state, unauthenticated and banned.
- **Property-based:** a fast-check test of `match(pool, exclusions, seed)` ([matching](../architecture/mechanisms/matching.md)) checking FUNC-002: every pairing is mutual and no user is in two pairings of a round.

## CI/CD

[`ci.yml`](../../.github/workflows/ci.yml) is one job that runs lint, type checks, the spec check, `npm audit` and the e2e tests; it runs no unit tests and no coverage. We merged everything into one job to save minutes, but GitHub Actions stopped anyway when the organization's minutes ran out. Once the self-hosted runner works, `npm run test:coverage` will run on every pull request and fail below a threshold, raised to the MAIN-001 target of 70% statements. TODO: the starting threshold and when the runner is ready.

---

## Bonuses

### Mutation Testing

Evidence needed:

- the Stryker configuration and the module it was run on;
- the mutation score;
- one surviving mutant;
- the test written to kill it.

TODO

### Property-Based Test

Evidence needed:

- at least one fast-check property in `tests/`;
- one sentence on what property the test checks and why it must hold for any input.

TODO

### Coverage Gate in CI

Evidence needed:

- coverage running in CI on every pull request;
- the threshold, and why that value;
- a link to a successful run.

TODO

## AI Usage Note

This document was drafted with Claude Code from the repository's tests, CI workflow and requirements, and reviewed by the team. The coverage numbers come from a local run.
