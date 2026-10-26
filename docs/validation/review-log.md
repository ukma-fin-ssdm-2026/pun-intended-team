# Review Log

How the [test plan](test-plan.md) was reviewed by another team, what we changed after it, and the review of AI-generated code against the course checklist (Lab 7).

## Peer Review of the Test Plan

- **Reviewing team:** Whadio, Team 9 ([ukma-fin-ssdm-2026/Whadio](https://github.com/ukma-fin-ssdm-2026/Whadio))
- **Their review:** issue [#283](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/283), "Review test-plan.md (Feedback from Team 9)", by @t-zlata: four findings, each with suggested fixes.

### Checklist

Whadio's checklist, from the updated issue. They marked all five criteria Blocking; the review describes the plan before the changes below.

| № | Criterion | Yes/No | Their comment |
|---|---|---|---|
| 1 | Key requirements and critical paths are covered | No, Blocking | Profile editing, underage rejection, the full matching behaviour, the positive contact reveal and the failed performance run are not fully covered. |
| 2 | Acceptance criteria are clearly stated | No, Blocking | Several cases lack exact expected results, boundary values, authorization outcomes and measurable performance thresholds. |
| 3 | Negative scenarios are tested | No, Blocking | Invalid profile updates, underage users, excluded or unmatched candidates, unauthorized contact requests and performance failures are not fully covered. |
| 4 | Each test traces to a requirement (Lab 2) | No, Blocking | Existing tests are not consistently mapped to test cases or to requirement IDs such as SAFE-001 and PERF-001. |
| 5 | The plan is realistic and runs in CI | No, Blocking | The k6 run failed with the cause unresolved, and there is no reproducible setup for the tests against the real persistence layer. |

### Strengths

1. The plan targets the safety-sensitive areas: age validation, matching, contact disclosure and performance.
2. Existing tests in the repository already give evidence the plan can link to.
3. The performance goals are measurable, and the failed run is recorded rather than hidden.

### Areas for Improvement

Their two improvement proposals:

1. **Complete the RTM:** test IDs, references to the tests, owners and execution results.
2. **Separate CI tests from staging load tests,** with the environment, fixtures, commands and pass/fail thresholds of each.

Their four findings; the first three are accepted, the fourth is left for the staging run:

1. **Profile editing has no test case.** The scope includes editing, but only profile creation (TC-12) was in the plan, although e2e tests for `PATCH /me/profile` and the interests existed.
2. **Underage registration is not traced.** Only the positive case was in the plan (TC-23); the tests for refusing someone under 18 existed but had no row, so SAFE-001 was traced only halfway.
3. **Matching and contact reveal are planned too narrowly.** Determinism, exclusions, ties, concurrency and users left unmatched were missing, and the contact reveal had only the negative case.
4. **The failed k6 run is not followed up.** TC-10 failed on the maximum time and two errors, and the cause was written down as not investigated.

### Changes After the Review

| Finding | Decision | What we changed |
|---|---|---|
| 1. Profile editing | Accepted | TC-32 to TC-35: unit tests for `ProfilesService.update` and `replaceInterests` (new), the existing e2e tests for `PATCH /me/profile` and the interests, and two new e2e tests: a change is still there on the next `GET`, and `PATCH` without a token gets `401`. Editing another user's profile is out of scope with the reason: the endpoints are `/me/profile` only, so no request can name another profile. Unsaved form values (INTC-003) are out of scope as client behaviour. |
| 2. Underage users | Accepted | TC-30 (unit: the day before the 18th birthday, an hour before Kyiv midnight on it, 29 February on 28 February; the account is deleted and no session starts) and TC-31 (integration: `422 UNDERAGE`, then `404` for the same token), both pointing at existing tests, and a SAFE-001 risk row. |
| 3. Matching and contact reveal | Accepted as planned rows | TC-36 determinism and tie order (FUNC-001), TC-37 exclusions and unmatched users (FR-020, FR-018), TC-38 the reveal after both accept (FR-019), TC-39 no contact before the safety notice is acknowledged (SAFE-002, FR-032), TC-40 concurrent requests (FUNC-002). TC-14 and TC-36 are done since `match` was built (Bonuses in the test plan); the others become due with the rest of matching. |
| 4. Failed k6 run | Not changed now | The run is a local measurement on one laptop shared by the API, PostgreSQL and k6, with listings still served from memory; the test plan already says so and keeps TC-10 planned until staging, where it is repeated with the real persistence layer. The cause of the two failures and the 30 s request is not investigated in this lab. |
| Checklist 2. Acceptance criteria | Open | Not changed yet. Each row states one expected result; preconditions, request data and database changes per row were not added. |
| Proposal 1. Complete the RTM | Partly | The new test case IDs are in the Tests column of `rtm.md`. Owners and status are kept in the test plan (Owner and Status columns), not in the RTM. |
| Proposal 2. CI and staging tests | Already in the plan | TC-10 is a k6 script outside CI and stays planned until staging; its command and environment are in Bonuses. The other rows run in CI. |

The new test case IDs are in the Tests column of `rtm.md` (FR-001, FR-002, FR-017 to FR-020, FR-032).

## Review of AI-Generated Code

- **Pull request:** [#258](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/pull/258), basic event import (#211, FR-008, FLEX-003). The code and tests were generated with Claude Code; the author checked them by running the tests and the import.
- **Reviewer:** Viktoriia Baran, in the review comments on the pull request.

| № | Criterion | Yes/No | Comment |
|---|---|---|---|
| 1 | Every imported package is real and actually used (no hallucinated dependencies) | Yes | The pull request adds no dependency: it uses `zod`, `@nestjs/common`, `@nestjs/core` and `node:crypto`, which the project already had, and `npm audit` stays at zero findings. |
| 2 | Error handling covers realistic failures, not only the happy path | Yes | A record that fails the schema, has an unknown genre or category, or ends before it starts is skipped and reported (FR-015, TC-24); a failed fetch stops the run before anything is saved (FR-014, TC-28). Not covered yet: a storage error halfway through a run leaves the records before it saved, since there is no transaction until events are in the database. |
| 3 | The logic matches the requirements and the test plan, not just "looks right" | No, fixed after review | The review found three places that looked right but did not follow the documents: an event with no end lasted two hours instead of until the end of its Kyiv day (data-model.md); imported venues were found by having no organization instead of by `source`; and `IMPORT_ON_START` made the API call the import, which HLD §4.3 rules out. All three were changed before merge. |
| 4 | No dead code: no generated functions that nothing calls | Yes | Every class and function is called by the service, the start command or the tests. One unused parameter remains on purpose: `EventProvider.fetch(since?)`, for incremental runs once the provider allows them. |
| 5 | The author explained the key decisions in reply to the reviewer's questions | Yes | Each review thread has a reply saying what was changed and why, e.g. why `IMPORT_ON_START` was dropped rather than limited to development. |

The review also moved the import out of the catalog into its own module with its own repository (`src/core/import/`), so the API never builds it. That was a design comment rather than a checklist item.

## Review of AI-generated code (#285)

| № | Criterion | Yes/No | Comment |
|---|---|---|---|
| 1 | All imported packages are real and used | Yes | Only local imports, no external packages. Unused imports are caught by ESLint (`no-unused-vars`); a missing module fails the build (TS2307). |
| 2 | Error handling covers realistic failures | Yes, Nit (fixed) | Empty pool and fully excluded pool are tested. **Nit:** a duplicated `userId` in the pool paired a user with themselves (`[u1, u1]` gave `u1+u1`). The pool builder is expected to prevent duplicates; still, a failing test (`6a764d1`) and the fix (`0eb195a`) were added after the review. |
| 3 | Logic matches the requirements and the test plan | Yes | Mutation check: ignoring the seed, sorting from the lowest score, ignoring exclusions and dropping the greedy check each made 1–7 tests fail. |
| 4 | No dead code | Yes | Line, branch and function coverage of `match.ts` is 100%; every helper is called. |
| 5 | The author explained key decisions on request | Yes | Asked about duplicated users and about sorting after the shuffle; both answered (stable sort keeps the shuffled order only among equal scores). |

## AI Usage Note

Drafted with Claude Code from the pull request, its review comments and the test plan; the review results come from the reviewers and were checked by the team.
