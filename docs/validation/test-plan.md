# Test Plan

## Scope

- **Event catalog:** browsing and filtering events, and posting, validating, editing and cancelling them (FR-006, FR-007, FR-009 to FR-011).
- **Listings:** creating and browsing listings (FR-021, FR-022).
- **Moderation and statistics:** reporting a user, grouping the reports into cases, banning or dismissing, and the administrator's statistics (FR-025 to FR-027, FR-030).
- **Categories:** the public list and the admin endpoints (FR-029).
- **Profile:** creating and editing the user's own profile (FR-002).
- **Interest overlap:** the score of shared interests between two users (FR-017).
- **Matching:** pairing by interest score in a round, the pairing rules and the contact reveal (FR-017, FR-019, FUNC-002, SEC-001); planned until matching is built.
- **Registration and sign-in** (critical path): the verification code, the age check, password sign-in and its lockout, and sign-out (FR-001, FR-005, SAFE-001, SEC-005, SEC-007, SEC-008).
- **Event import:** taking a provider's events into the catalog, skipping records that cannot be mapped, keeping the last events when a run fails, and adding a provider behind one adapter (FR-008, FR-014, FR-015, FLEX-003).

**Out of scope:**

- **Code delivery from the messaging provider to the phone:** SEC-008 puts it outside our control, since it depends on the carrier; tests stop at the hand-over to the provider.
- **The live external services** (Telegram Gateway, TurboSMS, Google): tests replace them with stubs and local fake servers and never call the real services.
- **The Expo client UI:** the project has no UI test tooling yet.
- **Notifications** (FR-023, FR-024): designed but not built yet; rows are added once they are implemented.
- **The real Concert.ua feed:** the adapter reads a sample feed until the provider gives us access (R-001); the tests use the sample feed and fake providers.
- **The "last updated" notice of FR-014:** the client part is not built; TC-28 checks only that a failed run leaves the imported events as they were.
- **Editing another user's profile:** there is no such request. The profile endpoints are `/me/profile` only, and the account comes from the access token; TC-34 covers a request without one.
- **Keeping unsaved form values on the device** (INTC-003): client behaviour, part of the Expo client UI above.

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
| One bad provider record stops the import, or a second run duplicates events | The catalog loses every imported event, or shows the same concert twice | TC-24, TC-25, TC-26 |
| A failed import run empties the catalog | Users see no events while the provider is down | TC-28 |
| Someone under 18 completes registration | A minor gets an active account and can be matched with adults (SAFE-001) | TC-08, TC-30, TC-31 |
| An incomplete event is published, or an organization changes another's event | The catalog shows events with missing details, or an organization's event is rewritten by someone else | TC-43, TC-44, TC-45, TC-46, TC-47, TC-48 |
| A banned user keeps using the app, or a report case is resolved twice | Someone reported for dangerous behaviour can still meet people; or a dismissed case bans the user after all | TC-53, TC-54, TC-55 |
| Repeated reports on one user scatter into several cases | The administrator does not see how often a user was reported (FR-026) | TC-52 |
| A profile change is lost, or a username is taken twice | The user sees old data after saving, or two people share one name | TC-32, TC-33, TC-34, TC-35 |

## Test Cases

*Paused:* the endpoint has no route while sign-in is Google-only ([ADR-004](../architecture/decisions/ADR-004.md)); its test returns with the route.

| № | Component/function | Level | Type | Expected result / acceptance criterion | Owner | Requirement | Status |
|---|---|---|---|---|---|---|---|
| TC-01 | `ListingsService.create` | Unit | Negative | A listing dated yesterday is rejected and nothing is stored | Viktoriia Baran | FR-021 | done |
| TC-02 | `POST /listings` | Integration | Negative | A listing with a past date is refused with `422` | Viktoriia Baran | FR-021 | done |
| TC-03 | `GET /listings` | Integration | Positive | US-010 AC1: a listing posted by one user is visible to another | Vlad Redchuk | FR-021, FR-022 | planned |
| TC-04 | `DELETE /listings/{id}`, then `GET /listings/{id}` | Integration | Negative | A listing its author removed is no longer returned: `GET /listings/{id}` answers `404` | Vlad Redchuk | FR-022 | done |
| TC-05 | `CategoriesService.listActive` | Unit | Negative | Inactive categories are left out of the list | Daryna Halytska | FR-029 | done |
| TC-06 | `GET /categories` | Integration | Negative | Inactive categories are left out of the public list | Viktoriia Baran | FR-029 | done |
| TC-07 | `POST /admin/categories` | Integration | Positive | An admin adds a category; it is saved as active and answered with `201` | Viktoriia Baran | FR-029 | done |
| TC-08 | `ageOn` | Unit | Positive | The birthday counts as a full year, and a 29 February birthday counts from 1 March | Viktoriia Baran | FR-002, SAFE-001 | done |
| TC-09 | `interestOverlap` | Unit | Positive | The score is shared interests over all distinct interests; identical lists score 1, disjoint lists 0 | Daryna Halytska | FR-017 | done |
| TC-10 | Listings under load (k6) | System | Positive | 500 concurrent sessions for 10 minutes on `GET /listings`: p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms | Daryna Halytska | FR-022, PERF-001 | planned |
| TC-11 | Dependency audit in CI | System | Negative | `npm audit --audit-level=high` finds zero High and zero Critical advisories | Daryna Halytska | SEC-006 | done |
| TC-12 | `POST /me/profile` | Integration | Positive | A new profile is answered with `201` and `Location: /api/v1/me/profile`, with no interests and `isComplete: false` | Oleh Moshenskyi | FR-002 | done |
| TC-13 | Matching round over one event session | Integration | Positive | US-009 AC1: of three applicants, A and B score 0.75 and A and C score 0.2; the round proposes A with B and leaves C in the pool | TBD | FR-017 | planned |
| TC-14 | `match(pool, exclusions, seed)` | Unit | Negative | Property test over generated pools: zero pairings where A → B without B → A, and zero users in two pairings of one round | Vlad Redchuk | FR-017, FUNC-002 | done |
| TC-15 | Contact reveal | Integration | Negative | A contact request for a match with only one acceptance is answered with `404`, as if the match did not exist | TBD | FR-019, SEC-001 | planned |
| TC-16 | `AuthService.verify` | Unit | Negative | After 3 failed attempts even the right code is refused with `INVALID_CODE` and is not marked used | Viktoriia Baran | FR-005, SEC-008 | done |
| TC-17 | `POST /auth/verify` | Integration | Negative | After 3 wrong codes the right code is refused with `422 INVALID_CODE` | Viktoriia Baran | FR-005, SEC-008 | paused |
| TC-18 | `POST /auth/register` | Integration | Negative | A second request for the same number within a minute is answered with `202` like the first, and no second code is sent | Viktoriia Baran | FR-005, SEC-008 | paused |
| TC-19 | `afterSignIn` | Unit | Negative | The 5th failed sign-in within 15 minutes locks the account for 15 minutes and clears the count | Viktoriia Baran | FR-001, SEC-007 | done |
| TC-20 | `POST /auth/sign-in` | Integration | Negative | After 5 wrong passwords the right password is refused with `401` and the same body as a wrong password | Viktoriia Baran | FR-001, SEC-007 | paused |
| TC-21 | `SessionsService.end` | Unit | Positive | Sign-out revokes the session with the current time as its revocation time | Viktoriia Baran | FR-001, SEC-005 | done |
| TC-22 | `POST /auth/sign-out` | Integration | Negative | Sign-out answers `204`; then its access token gets `401` and its refresh token `401 INVALID_REFRESH_TOKEN`, while another session of the account still gets `200` | Viktoriia Baran | FR-001, SEC-005 | done |
| TC-23 | `POST /auth/complete-registration` | Integration | Positive | Someone who turns 18 today is activated with `200`, and the returned access token reads listings with `200` | Viktoriia Baran | FR-001, FR-005, SAFE-001 | done |
| TC-24 | `EventImportService.run` | Unit | Negative | Of two records, one the adapter cannot map is reported in `skipped` with its id and reason, and the other is still created | Oleh Moshenskyi | FR-015 | done |
| TC-25 | `EventImportService.run` | Unit | Positive | A record whose event was saved before with the same fields is counted as `unchanged`; nothing is created or updated | Oleh Moshenskyi | FR-008 | done |
| TC-26 | Import into the catalog (in-memory repositories) | Unit | Positive | After one run of the Concert.ua sample feed, `EventsService.list` returns its 3 usable events with `source: import` and no organization; a second run reports 0 created, 0 updated, 3 unchanged | Oleh Moshenskyi | FR-008, FR-015 | done |
| TC-27 | Second provider (FLEX-003) | Unit | Positive | A second adapter with its own id and record shape is imported and served by `EventsService.list`, with no change outside the adapter | Oleh Moshenskyi | FR-008, FLEX-003 | done |
| TC-28 | `EventImportService.run` | Unit | Negative | When the provider's fetch fails, the run rejects and saves nothing, so the events of the last run stay in the catalog | Oleh Moshenskyi | FR-014, REL-003 | done |
| TC-29 | `npm run import:events`, then `GET /events` | Integration | Positive | Events imported by the import's own process are returned by the API next to organization events | Oleh Moshenskyi | FR-008 | planned |
| TC-30 | `AuthService.completeRegistration` | Unit | Negative | Someone who turns 18 tomorrow, someone an hour before Kyiv midnight on their 18th birthday, and someone born on 29 February on 28 February are refused with `UNDERAGE`; the pending account is deleted and no session is started | Viktoriia Baran | FR-001, SAFE-001 | done |
| TC-31 | `POST /auth/complete-registration` | Integration | Negative | Someone who turns 18 tomorrow is refused with `422 UNDERAGE` and gets no tokens; the registration is removed, so the same registration token then gets `404` | Viktoriia Baran | FR-001, SAFE-001 | done |
| TC-32 | `ProfilesService.update` | Unit | Negative | A username another account has is refused with `USERNAME_TAKEN` and nothing is saved; the owner's own username in another case is accepted; before the profile exists the answer is `NOT_FOUND` | Oleh Moshenskyi | FR-002 | done |
| TC-33 | `PATCH /me/profile` | Integration | Positive | Only the fields sent change, and a later `GET /me/profile` returns the new values while the fields not sent keep theirs | Oleh Moshenskyi | FR-002 | done |
| TC-34 | `PATCH /me/profile` | Integration | Negative | No token gets `401`; an unknown `communicationFormat` or an empty body gets `400`; another user's username gets `409 USERNAME_TAKEN`; an account without a profile gets `404` | Oleh Moshenskyi | FR-002 | done |
| TC-35 | `PUT /me/profile/interests` | Integration | Negative | A list with an unknown interest id is refused with `422 REFERENCE_NOT_FOUND`, and `GET /me/profile` still returns the interests from before | Oleh Moshenskyi | FR-002 | done |
| TC-36 | `match(pool, exclusions, seed)` | Unit | Positive | 10 runs with the same pool and seed return the same pairings; two seeds order tied candidates differently | Vlad Redchuk | FR-017, FUNC-001 | done |
| TC-37 | `match(pool, exclusions, seed)` | Unit | Negative | The user themselves, banned accounts, users they reported, and candidates declined or expired for this event are never proposed; a user with no candidate left stays in the pool unmatched | TBD | FR-018, FR-020 | planned |
| TC-38 | Contact reveal | Integration | Positive | After both users accept the match, each gets the other's contact details with `200` | TBD | FR-019 | planned |
| TC-39 | Contact reveal | Integration | Negative | On a user's first match, a contact request before the safety notice is acknowledged returns no contact details, also when the API is called directly; after the acknowledgment the same request gets them | TBD | FR-032, SAFE-002 | planned |
| TC-40 | Matching under concurrent requests | Integration | Negative | Overlapping match requests that all rank the same candidate first: exactly one of them gets that candidate | TBD | FR-017, FUNC-002 | planned |
| TC-41 | `EventsService.list` | Unit | Positive | Without dates the catalog covers the Kyiv date of today to the end of the window; a start in the past and an end beyond the window are moved inside it; the category and venue filters are passed on unchanged | Viktoriia Baran | FR-006, FR-007 | done |
| TC-42 | `GET /events` | Integration | Positive | A guest token, issued without signing in, gets `200` with a page of events | Vlad Redchuk | FR-006 | done |
| TC-43 | `EventsService.create` | Unit | Negative | An organization that is not verified, an account that is not an organization, an inactive category, and an unknown venue or one of another organization are refused, and nothing is saved | Viktoriia Baran | FR-009 | done |
| TC-44 | `POST /events` | Integration | Positive | A verified organization publishes an event with `201` and `Location: /api/v1/events/{id}`; an organization that is not verified and a regular user get `422 ORGANIZATION_NOT_VERIFIED`, a guest `401` | Oleh Moshenskyi | FR-009 | done |
| TC-45 | `CreateEventBody` | Unit | Negative | A body without any one of title, description, category, venue, start or end is rejected with one issue pointing at that field | Viktoriia Baran | FR-010 | done |
| TC-46 | `POST /events` | Integration | Negative | A body without a title and a venue and with an invalid start gets `400` with one details entry per field; an event that ends before it starts gets `422 EVENT_ENDS_BEFORE_START` | Oleh Moshenskyi | FR-010 | done |
| TC-47 | `EventsService.update`, `EventsService.cancel` | Unit | Negative | Another organization is told the event does not exist; a cancelled event cannot be edited; cancelling a cancelled event returns it unchanged without saving | Viktoriia Baran | FR-011 | done |
| TC-48 | `PUT /events/{id}`, `POST /events/{id}/cancel` | Integration | Positive | The organization's own event is replaced with `200` and cancelled with status `cancelled`; another organization and a regular user get `404`; editing a cancelled event gets `422 EVENT_CANCELLED` | Oleh Moshenskyi | FR-011 | done |
| TC-49 | `ModerationService.report` | Unit | Negative | A username no profile has is refused with `REFERENCE_NOT_FOUND` and the caller's own with `CANNOT_REPORT_SELF`; nothing is stored | Viktoriia Baran | FR-025 | done |
| TC-50 | `POST /reports` | Integration | Positive | A report on another user's username, in other letter case, answers `204` and opens a case on that user | Viktoriia Baran | FR-025 | done |
| TC-51 | `POST /reports` | Integration | Negative | An unknown username gets `422 REFERENCE_NOT_FOUND`, the caller's own `422 CANNOT_REPORT_SELF`, a reason outside the list `400`, a guest token `401` | Viktoriia Baran | FR-025 | done |
| TC-52 | `GET /admin/report-cases`, `GET /admin/report-cases/{id}` | Integration | Positive | US-008 AC2: three reports on one user, two of them by one reporter, the second with a comment, make one open case with `reportCount: 3`, and the case lists all three with their reporters, oldest first | Viktoriia Baran | FR-026 | done |
| TC-53 | `POST /admin/report-cases/{id}/ban` | Integration | Positive | US-005 AC1: the case is resolved as `banned`, the reported user's next request with a token issued before gets `401`, and the audit log has the ban with the administrator as actor | Viktoriia Baran | FR-027, SEC-004, SEC-005 | done |
| TC-54 | `ModerationService.ban` | Unit | Negative | A case resolved in the meantime is refused with `CONFLICT`; no one is banned and nothing is logged | Viktoriia Baran | FR-027 | done |
| TC-55 | `POST /admin/report-cases/{id}/dismiss`, then `…/ban` | Integration | Negative | A dismissed case cannot be banned (`409`), the user stays signed in, and the next report on them opens a new case | Viktoriia Baran | FR-026, FR-027 | done |
| TC-56 | `GET /admin/stats` | Integration | Positive | Active users, matches and open report cases equal the counts in the database, and upcoming events are counted; a user who is not an administrator gets `404` | Viktoriia Baran | FR-030, SEC-001 | done |

Owners marked TBD are assigned when the team schedules the test.

## Exit Criteria

Testing under this plan is complete when all of the following hold:

- Every row for a feature that is built is **done** and passes in CI: the `CI passed` job is green on `main`.
- Rows for features not built yet become due once the feature is implemented: TC-13, TC-15 and TC-37 to TC-40 with the matching rounds, and TC-29 once events are stored in the database. TC-10 is due now that staging exists; so far it has been run only locally.
- The coverage gate passes: at least 90% of lines and 80% of branches over all tests (`npm run test:coverage`, set in `mcr.config.mjs`).
- No critical defect is open.

## Bonuses

### Executable non-functional test: TC-10, local run

TC-10 is an executable k6 script, [`tests/perf/listings.k6.js`](../../tests/perf/listings.k6.js). 500 virtual users (`constant-vus`) run for 10 minutes; each iteration calls `GET /api/v1/listings`, checks for `200` and waits 1 s. `setup()` checks the access token from `PERF_TOKEN`, the token of a Google sign-in, and shares it, since k6 cannot sign in with Google. The PERF-001 thresholds apply to the listings requests only, and k6 exits non-zero when one fails. It is not part of CI.

```bash
npx prisma migrate deploy                 # local database
npm run build && npm start                # production build of the API on port 4100
PERF_TOKEN=<access token> npm run test:perf   # k6 2.3.0 in Docker (grafana/k6) against http://host.docker.internal:4100
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

### Tests as a specification for an agent: `match`

The tests for `match(pool, exclusions, seed)`, the pairing of one matching round, were written in [`match.test.ts`](../../tests/unit/match.test.ts) and committed failing before the function existed. Claude Code then wrote [`match.ts`](../../src/core/matching/services/match.ts) until they passed. The code was reviewed with the Lab 7 AI code review checklist; the review is in the [review log](review-log.md).

| Commit | What it contains |
|---|---|
| `cbcbf7f` | Failing tests: the module does not exist yet |
| `9f3ec67` | Tie test fix: compare which users are paired, not the JSON of the result |
| `af94ad1` | Score check fix: `pairings[0]?.score`, for `noUncheckedIndexedAccess` |
| `c551e99` | Implementation; all tests pass |
| `6a764d1` | Failing test from the review: a user listed twice in the pool is paired with themselves |
| `0eb195a` | Fix from the review: a user is never paired with themselves |

**AI usage:** Claude Code generated the tests and the function. It took 3 runs to get the tests green; none failed on the logic, only the types needed fixing (`noUncheckedIndexedAccess`). Changed by a person: after reading the tests, the reviewer asked for the tie test to compare which users are paired rather than the JSON, and fixed the score check on line 58 (`pairings[0]?.score`) themselves. The review found that a user could be paired with themselves; it was fixed with a failing test first, then the fix.

```bash
npx nest build && node --test tests/unit/match.test.ts
```

## AI Usage Note

Drafted with Claude Code from the lab requirements, the repository's tests and the requirements documents; reviewed by the team.
