# Review Log

How the [test plan](test-plan.md) was reviewed by another team, what we changed after it, and the review of AI-generated code against the course checklist (Lab 7).

## Peer Review of the Test Plan

- **Reviewing team:** Whadio, Team 9 ([ukma-fin-ssdm-2026/Whadio](https://github.com/ukma-fin-ssdm-2026/Whadio))
- **Their review:** issue [#283](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/issues/283), "Review test-plan.md (Feedback from Team 9)", by @t-zlata: four findings, each with suggested fixes.

### Checklist

Whadio sent their findings as an issue and did not fill in the course checklist. The findings touch these criteria (our mapping):

| № | Criterion | Findings |
|---|---|---|
| 1 | Key requirements and critical paths are covered | 1 (profile editing), 3 (matching and contact reveal) |
| 2 | Acceptance criteria are clearly stated | none |
| 3 | Negative scenarios are tested | 2 (underage registration), 3 (contact reveal) |
| 4 | Each test traces to a requirement (Lab 2) | 1 and 2: the tests existed but had no row in the plan |
| 5 | The plan is realistic and runs in CI | 4 (failed k6 run) |

### Strengths

We did not receive strengths in writing. In class, the plan was discussed with the reviewers orally: the test cases were called sound, with the positive and negative types used correctly.

### Areas for Improvement

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
| 3. Matching and contact reveal | Accepted as planned rows | TC-36 determinism and tie order (FUNC-001), TC-37 exclusions and unmatched users (FR-020, FR-018), TC-38 the reveal after both accept (FR-019), TC-39 no contact before the safety notice is acknowledged (SAFE-002, FR-032), TC-40 concurrent requests (FUNC-002). They become due with matching, which is not built yet. |
| 4. Failed k6 run | Not changed now | The run is a local measurement on one laptop shared by the API, PostgreSQL and k6, with listings still served from memory; the test plan already says so and keeps TC-10 planned until staging, where it is repeated with the real persistence layer. The cause of the two failures and the 30 s request is not investigated in this lab. |

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

## Review for AI-generated code  (#285)

| № | Criterion | Yes/No | Comment |
|---|---|---|---|
| 1 | All imported packages are real and used | Yes | Only local imports, no external packages. Unused imports are caught by ESLint (`no-unused-vars`); a missing module fails the build (TS2307). |
| 2 | Error handling covers realistic failures | Yes, Nit | Empty pool and fully excluded pool are tested. **Nit:** a duplicated `userId` in the pool produces a pairing of a user with themselves (confirmed: `[u1, u1]` → `u1+u1`). The pool builder is expected to prevent duplicates, but `match` relies on it silently. |
| 3 | Logic matches the requirements and the test plan | Yes | Mutation check: ignoring the seed, sorting from the lowest score, ignoring exclusions and dropping the greedy check each made 1–7 tests fail. |
| 4 | No dead code | Yes | Line, branch and function coverage of `match.ts` is 100%; every helper is called. |
| 5 | The author explained key decisions on request | Yes | Asked about duplicated users and about sorting after the shuffle; both answered (stable sort keeps the shuffled order only among equal scores). |

## AI Usage Note

Drafted with Claude Code from the pull request, its review comments and the test plan; the review results come from the reviewers and were checked by the team.
