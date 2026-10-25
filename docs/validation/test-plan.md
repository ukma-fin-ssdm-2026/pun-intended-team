# Test Plan

## Scope

- **Listings:** creating and browsing listings (FR-021, FR-022).
- **Categories:** the public list and the admin endpoints (FR-029).
- **Profile:** creating and editing the user's own profile (FR-002).
- **Interest overlap:** the score of shared interests between two users (FR-017).
- **Matching:** pairing by interest score in a round, the pairing rules and the contact reveal (FR-017, FR-019, FUNC-002, SEC-001); planned until matching is built.
- **Registration and sign-in** (critical path): the verification code, the age check, password sign-in and its lockout, and sign-out (FR-001, FR-005, SAFE-001, SEC-005, SEC-007, SEC-008).

**Out of scope:**

- **Code delivery from the messaging provider to the phone:** SEC-008 puts it outside our control, since it depends on the carrier; tests stop at the hand-over to the provider.
- **The live external services** (Telegram Gateway, TurboSMS, Google): tests replace them with stubs and local fake servers and never call the real services.
- **The Expo client UI:** the project has no UI test tooling yet.
- **Notifications** (FR-023, FR-024): designed but not built yet; rows are added once they are implemented.

## Test Levels

| Level | Where |
|---|---|
| Unit | `tests/unit/` |
| Integration | `tests/e2e/` |
| System | staging, planned |
| Acceptance | deployed system, planned |

## Risks

| Risk | Why it matters | Tests |
|---|---|---|
| Dates are counted in UTC, not Kyiv time | Listings vanish or stay a day too long around midnight; ages are off by a day | TC-01, TC-02, TC-08 |
| An inactive category is offered to users | New listings land in a category the admins have retired | TC-05, TC-06 |
| The interest score is wrong | Poor matches once matching runs | TC-09 |
| Listings are slow under load | Browsing is what most sessions do | TC-10 |
| A dependency with a known vulnerability ships | An attack we could have prevented | TC-11 |
| A round ignores the interest score | Users are paired with someone they share little with, although a better candidate was in the pool | TC-09, TC-13 |
| A user is paired twice in one round, or a pairing is one-sided | Two people expect the same partner; one of them is left without a match | TC-14 |
| Contacts are revealed before both users accept | A phone number reaches someone its owner never agreed to meet | TC-15 |
| A verification code or a password can be guessed | An attacker takes over an account or registers a number that is not theirs | TC-16, TC-17, TC-18, TC-19, TC-20 |
| A signed-out session keeps working | A lost or shared phone stays signed in until the token expires | TC-21, TC-22 |

## Test Cases

| № | Component/function | Level | Type | Expected result / acceptance criterion | Owner | Requirement | Status |
|---|---|---|---|---|---|---|---|
| TC-01 | `ListingsService.create` | Unit | Negative | A listing dated yesterday is rejected and nothing is stored | Viktoriia Baran | FR-021 | done |
| TC-02 | `POST /listings` | Integration | Negative | A listing with a past date is refused with `422` | Viktoriia Baran | FR-021 | done |
| TC-03 | `GET /listings` | Integration | Positive | US-010 AC1: a listing posted by one user is visible to another | Vlad Redchuk | FR-021, FR-022 | planned |
| TC-04 | `GET /listings` | Integration | Negative | A listing its author removed is no longer returned | TBD | FR-022 | planned |
| TC-05 | `CategoriesService.listActive` | Unit | Negative | Inactive categories are left out of the list | Vlad Redchuk | FR-029 | planned |
| TC-06 | `GET /categories` | Integration | Negative | Inactive categories are left out of the public list | Viktoriia Baran | FR-029 | done |
| TC-07 | `POST /admin/categories` | Integration | Positive | An admin adds a category; it is saved as active and answered with `201` | Viktoriia Baran | FR-029 | done |
| TC-08 | `ageOn` | Unit | Positive | The birthday counts as a full year, and a 29 February birthday counts from 1 March | Viktoriia Baran | FR-002, SAFE-001 | done |
| TC-09 | `interestOverlap` | Unit | Positive | The score is shared interests over all distinct interests; identical lists score 1, disjoint lists 0 | Daryna Halytska | FR-017 | done |
| TC-10 | Listings under load (k6) | System | Positive | 500 concurrent sessions for 10 minutes on `GET /listings`: p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms | Daryna Halytska | FR-022, PERF-001 | planned |
| TC-11 | Dependency audit in CI | System | Negative | `npm audit --audit-level=high` finds zero High and zero Critical advisories | Daryna Halytska | SEC-006 | done |
| TC-12 | `POST /me/profile` | Integration | Positive | A new profile is answered with `201` and `Location: /api/v1/me/profile`, with no interests and `isComplete: false` | Oleh Moshenskyi | FR-002 | done |
| TC-13 | Matching round over one event session | Integration | Positive | US-009 AC1: of three applicants, A and B score 0.75 and A and C score 0.2; the round proposes A with B and leaves C in the pool | TBD | FR-017 | planned |
| TC-14 | `match(pool, exclusions, seed)` | Unit | Negative | Property test over generated pools: zero pairings where A → B without B → A, and zero users in two pairings of one round | TBD | FR-017, FUNC-002 | planned |
| TC-15 | Contact reveal | Integration | Negative | A contact request for a match with only one acceptance is answered with `404`, as if the match did not exist | TBD | FR-019, SEC-001 | planned |
| TC-16 | `AuthService.verify` | Unit | Negative | After 3 failed attempts even the right code is refused with `INVALID_CODE` and is not marked used | Viktoriia Baran | FR-005, SEC-008 | done |
| TC-17 | `POST /auth/verify` | Integration | Negative | After 3 wrong codes the right code is refused with `422 INVALID_CODE` | Viktoriia Baran | FR-005, SEC-008 | done |
| TC-18 | `POST /auth/register` | Integration | Negative | A second request for the same number within a minute is answered with `202` like the first, and no second code is sent | Viktoriia Baran | FR-005, SEC-008 | done |
| TC-19 | `afterSignIn` | Unit | Negative | The 5th failed sign-in within 15 minutes locks the account for 15 minutes and clears the count | Viktoriia Baran | FR-001, SEC-007 | done |
| TC-20 | `POST /auth/sign-in` | Integration | Negative | After 5 wrong passwords the right password is refused with `401` and the same body as a wrong password | Viktoriia Baran | FR-001, SEC-007 | done |
| TC-21 | `SessionsService.end` | Unit | Positive | Sign-out revokes the session with the current time as its revocation time | Viktoriia Baran | FR-001, SEC-005 | done |
| TC-22 | `POST /auth/sign-out` | Integration | Negative | Sign-out answers `204`; then its access token gets `401` and its refresh token `401 INVALID_REFRESH_TOKEN`, while another session of the account still gets `200` | Viktoriia Baran | FR-001, SEC-005 | done |
| TC-23 | `POST /auth/complete-registration` | Integration | Positive | Someone who turns 18 today is activated with `200`, and the returned access token reads listings with `200` | Viktoriia Baran | FR-001, FR-005, SAFE-001 | done |

Owners marked TBD are assigned when the team schedules the test.

## Exit Criteria

Testing under this plan is complete when all of the following hold:

- Every row for a feature that is built is **done** and passes in CI: the `CI passed` job is green on `main`.
- Rows for features not built yet become due once the feature is implemented: TC-13 to TC-15 with matching, and TC-10 once the staging environment exists.
- The coverage gate passes: at least 90% of lines and 80% of branches over all tests (`npm run test:coverage`, set in `mcr.config.mjs`).
- No critical defect is open.

## Bonuses

### Executable non-functional test: TC-10, local run

TC-10 is an executable k6 script, [`tests/perf/listings.k6.js`](../../tests/perf/listings.k6.js). 500 virtual users (`constant-vus`) run for 10 minutes; each iteration calls `GET /api/v1/listings`, checks for `200` and waits 1 s. `setup()` signs in once with a seeded account and shares the access token, since sign-in is rate-limited. The PERF-001 thresholds apply to the listings requests only, and k6 exits non-zero when one fails. It is not part of CI.

```bash
npx prisma migrate deploy && npm run db:seed   # local database with the development accounts
npm run build && npm start                     # production build of the API on port 4100
npm run test:perf                              # k6 2.3.0 in Docker (grafana/k6) against http://host.docker.internal:4100
```

Result of the run on 2026-10-24: **failed**, k6 exited with code 99.

| Metric | PERF-001 threshold | Measured | Result |
|---|---|---|---|
| p95 | ≤ 1000 ms | 699.97 ms | pass |
| p99 | ≤ 2000 ms | 953.13 ms | pass |
| max | ≤ 5000 ms | 30.01 s | fail |
| Error rate | 0 | 2 of 215,260 requests (0.0009%) | fail |

The run made 215,260 requests, 357 a second. The slowest request, 30.01 s, was one of the two failures; the slowest successful one took 7.93 s, so the maximum fails without them too. The cause is not investigated yet.

**Machine:** one laptop ran the API, PostgreSQL and k6 together: Intel Core i5-1135G7 (4 cores, 8 threads), 7.6 GiB RAM for WSL 2, Ubuntu 24.04 on WSL 2 under Windows, Docker Desktop 29.2.0, Node.js 26.10.0, `NODE_ENV=development`.

**What this result does not show:**

- It is a local run, not the staging run PERF-001 asks for. k6 shared the CPU with the API, which adds to the measured times. TC-10 on staging stays planned.
- Listings are still served from the in-memory stub repository; only the session check of each request reaches PostgreSQL. The result covers the HTTP layer, token validation and the session lookup, not database queries for listings.

### State transition table: sign-in lockout

SEC-007: 5 failed sign-ins for one account within 15 minutes lock it for 15 minutes. `afterSignIn` in [`sign-in-lockout.ts`](../../src/core/identity/services/sign-in-lockout.ts) returns the lockout state to save after each password sign-in.

States: **Clean**, no failures counted and no active lock; **Counting(n)**, n failures since the window start, 1 ≤ n ≤ 4; **Locked**, the lock end is in the future.

| ID | From | Event | Guard | To |
|---|---|---|---|---|
| T1 | Clean | wrong password | | Counting(1), window starts now |
| T2 | Clean | right password | | Clean |
| T3 | Counting(n < 4) | wrong password | inside the window | Counting(n + 1) |
| T4 | Counting(4) | wrong password | inside the window | Locked for 15 minutes, count cleared |
| T5 | Counting(n) | wrong password | window passed | Counting(1), window starts now |
| T6 | Counting(n) | right password | | Clean |
| T7 | Locked | wrong password | before the lock ends | Locked, unchanged |
| T8 | Locked | right password | before the lock ends | Locked, unchanged; sign-in rejected |
| T9 | Locked | wrong password | lock ended | Counting(1), window starts now |
| T10 | Locked | right password | lock ended | Clean |

[`sign-in-lockout.test.ts`](../../tests/unit/sign-in-lockout.test.ts), "afterSignIn, state transitions", has one case per row, named by its ID, e.g. `T4: Counting(4) --wrong password inside the window--> Locked`. Guards are tested at their boundaries: T4 at the last millisecond of the window, T5 the moment it passes, T7 and T8 at the last millisecond of the lock, T9 and T10 the moment it ends. A password reset also sets Clean; it is outside this table, since it does not go through `afterSignIn`.

## AI Usage Note

Drafted with Claude Code from the lab requirements, the repository's tests and the requirements documents; reviewed by the team.
