# Response to the Code Review

How the team handled the review of this repository by the reviewing team (Lab 5): an in-class review written without AI, and a second review by an AI agent (OpenCode, model Muse Spark 1.3), both of commit `00fc939e21b03c1556817c53eb81f7f3f76a9185`, with the reviewers' comparison of the two. Issue: #147. Our own review of another team is in [`review-report.md`](review-report.md).

## How the feedback was processed

Every remark was checked against the code and the documents of the repository as they are now, not taken as stated. Each got one decision:

| Decision | Meaning |
|---|---|
| **Accepted** | The remark is right; the work goes into a follow-up issue. |
| **Already done** | Fixed or covered since the reviewed commit. |
| **Partly done** | Part of it is fixed since the reviewed commit; the rest has a planned fix. |
| **Known, recorded** | We knew about it; it is written down and has a planned fix. |
| **Not accepted** | The remark does not hold; the reason is given. |

## What the reviewers praised

The code kept its shape after the review, and the checks that protect it stay in place: the layering rule in ESLint (`no-restricted-imports`) and the `@Endpoint` decorator, which keeps the framework out of the services; Argon2 and the same answer for an unknown phone and a wrong password (SEC-007); the end-to-end suite. Nothing to change.

## Remarks and decisions

| # | Remark | Source | Decision | What we found and what happens |
|---|---|---|---|---|
| R-01 | Too little logging: only the server start, unexpected `500`s and the stub's code are logged; no request log, no sign-in successes or failures, no admin actions. | Reviewers, AI (as a vulnerability combined with R-04) | **Accepted** | True. `Logger` is used in `main.ts`, `api-exception.filter.ts`, the messaging providers (with the phone masked) and once in `auth.service.ts`, for a reset code that could not be sent; sign-ins and admin actions are still not logged. SEC-004 requires a record of every sign-in (successful and failed) and every admin action, with no passwords, tokens or contacts in the output. The audit log comes with the database; a request log and sign-in events do not need it. Follow-up: **"Log requests and security events"** (`backend`). |
| R-02 | No session management and no revocation: tokens cannot be withdrawn on sign-out. | Reviewers | **Already done** | True at the reviewed commit: nothing stored sessions and there was no sign-out. Done in #212 (SEC-005): sessions are stored in the database, `POST /auth/refresh` rotates the refresh token, `POST /auth/sign-out` revokes the session, and `SessionsService` checks the session on every request, so a sign-out or a ban takes effect before the access token expires. |
| R-03 | Add isolated unit tests for the business logic, next to the end-to-end tests. | Reviewers, AI | **Already done** | The review was made before Lab 6. [`tests/unit/`](../../tests/unit/) now has unit tests with mocked repositories for the services, the date functions (`ageOn`, `kyivDate`, `addDays`), the match score and the auth adapters. See the [testing strategy](../testing/testing-strategy.md). |
| R-04 | No rate limiting; open to scraping and to guessing passwords and codes; with so little logging nobody would notice. | Reviewers, AI | **Partly done** | True at the reviewed commit. The password and code part is done in #212 (SEC-007, SEC-008): the lockout in [`sign-in-lockout.ts`](../../src/core/identity/services/sign-in-lockout.ts) (5 failed sign-ins in 15 minutes lock the account for 15 minutes, tested in `tests/unit/sign-in-lockout.test.ts`) is now called by `AuthService`; the eight sign-in, code, password and refresh endpoints have a per-IP limit (`ThrottlerGuard`, `AUTH_RATE_LIMIT_PER_MINUTE`, `429 RATE_LIMITED`); and a number gets at most one code a minute and five a day, each with three attempts. The AI's figure of about 4,300 guesses a day, from the counter starting again with every new code, is now 15 a day. Still open, and not part of #212: the per-token limit of SEC-007 on the public endpoints (100 requests a minute per guest or user token, a backstop of 1,000 per IP, [catalog access](../architecture/mechanisms/catalog-access.md) rule 4), which covers the catalog and `POST /auth/guest`. SA-04 in the [static analysis](static-analysis.md) stays open for that part. Follow-up: **"Per-token rate limits on the public endpoints (SEC-007)"** (`backend`), before any deployment. |
| R-05 | Magic numbers: field limits (`120`, `5000`, `2000`, `500`) written in several schemas. | AI | **Accepted** | Partly true. The limits are in `src/api/catalog/schemas/events.ts`, `listings/schemas/listings.ts` and `profiles/schemas/profiles.ts`; `120` is written for both the event and the listing title, and the event import (#211) now has to repeat the event limits so that an imported title can never be longer than the API allows. Each value is next to its `.describe()` text, which makes them readable, so this is a maintenance cost, not a defect. Follow-up: **"Name the field limits once"** (`refactor`): constants in `core/` used by the schemas and by the import adapter. |
| R-06 | `detailsFor` in `listings.service.ts` and `withDetails` in `profiles.service.ts` are duplicated join logic. | AI | **Not accepted** | Both are named after the same idea but do different work. `detailsFor` loads authors and categories for a list of listings in two parallel calls and returns a function; `withDetails` reads one account's date of birth and the interest list, computes the age and builds a different type. They share a pattern, not code, and a shared helper would need both modules' types. The reviewers also marked this remark as wrong. |
| R-07 | Error codes are kept in sync by hand in three places. | AI | **Not accepted** | Not true. `ErrorCode` in `api/common/schemas/errors.ts` is built from `domainErrorCodes` (`...domainErrorCodes`), so the schema follows `core/common/domain-error.ts` automatically. `errorStatus` in `api-exception.ts` is a `Record<ErrorCode, number>`, so a new code without a status does not compile. A new code means one edit in `core`, one line for its status, and the compiler points at the second. The reviewers also marked this remark as wrong. |
| R-08 | The validation log describes `PATCH /events/{id}`, the code has `PUT`. | AI | **Already done** | The log is the record of the Lab 4 run and is left as history, as [`progress.md`](progress.md) says; what was missing was a note in the log itself. A note now stands at the top of the validation log in [`quality-attributes.md`](../api/quality-attributes.md#4-validation-log). |
| R-09 | The dev server rewrites the committed spec on start (dirty diff); large committed Swagger UI files need manual syncing. | AI | **Known, recorded** | True and deliberate. The rewrite is development-only (`!isProduction`, see SA-02), and CI fails a pull request with a stale spec, so a forgotten commit is caught. The vendored Swagger UI under `docs/api/vendor/` is what GitHub Pages serves, and it changes only when the library is upgraded. We keep both. |
| R-10 | The MCP project uses `zod@3` and TypeScript 5.8, the API `zod@4` and 6.0; it uses `eval(jsonSchemaToZod)` and `any`; it is left out of Dependabot and ESLint. | AI | **Partly done** | The versions and `eval` are done: since #261, `src/mcp/` is generated by openapi-mcp-generator 5.0.0 (pinned in `tools/mcp-generator/`), which uses no zod and no `eval` (arguments are checked against the JSON Schema by `@cfworker/json-schema`) and TypeScript `^6.0.3`, like the API. What remains comes from the generator and is kept: 10 uses of `any` in `src/mcp/src/index.ts`, and the project is left out of Dependabot and ESLint on purpose (a comment in `.github/dependabot.yml` says so), because `src/mcp/` must not be edited by hand ([`AGENTS.md`](../../AGENTS.md)) and a change there would be overwritten by the next generation. Its dependencies are still checked by `npm audit` in CI. |
| R-11 | Seeded accounts with a known password (including an admin) and the verification code printed to the console. | AI (side note) | **Already done** | Done in #212. Accounts are in the database and the stub accounts are gone. The development accounts with a known password were later removed with the seed script in #325, when sign-in became Google-only ([ADR-004](../architecture/decisions/ADR-004.md)). Codes go to Telegram by default in production; production refuses `MESSAGING_PROVIDER=console` unless `ALLOW_TEST_ADAPTERS` is set, which only the e2e tests do. |
| R-12 | The pure functions `ageOn`, `kyiv-time.ts`, `checkTimes` and `isAtLeast` are covered only through the end-to-end tests. | AI | **Already done** | `ageOn`, `kyivDate` and `addDays` have their own tests; `checkTimes` is tested through `EventsService` (`EVENT_ENDS_BEFORE_START`), and `isAtLeast` through the age cases of `AuthService.verify`, including the leap-day birthday and the Kyiv midnight. |
| R-13 | `429 CODE_RESEND_TOO_SOON` and `409 CONFLICT` after a valid code reveal whether a number is registered. | AI (vulnerability) | **Partly accepted** | Since #212, `POST /auth/register` answers the same whether or not the number has an account and whether or not it reached a code limit; `CODE_RESEND_TOO_SOON` no longer exists. `409` comes only after a correct code, which only the owner of the number has, so the remaining leak is small and we keep it. |

## Where the reviewers' AI was wrong

The reviewers marked two remarks of the AI as wrong (R-06 and R-07), and our check agrees with both. Neither was a style opinion: one claims duplication that is not there, the other claims manual work that the compiler already does.

## Follow-up issues

Sessions and sign-out (R-02), the sign-in lockout, the limits on passwords and codes (R-04) and the seeded accounts (R-11) are done in #212, so they get no new issue. To be opened by the Issue Tracker Lead for what is left, with the `backend` area label:

1. **Log requests and security events** (R-01): request log without bodies or tokens, sign-in successes and failures with the phone masked, admin actions.
2. **Per-token rate limits on the public endpoints** (R-04): SEC-007 limits per guest or user token with the per-IP backstop, for the catalog and `POST /auth/guest`; its test is the one SEC-007 describes (over the cap, then `429` with `Retry-After`).
3. **Name the field limits once** (R-05), with the `refactor` label.

## What changed in the repository

- This document, linked from the [README](../../README.md).
- A note about `PATCH` and `PUT` in the validation log of [`quality-attributes.md`](../api/quality-attributes.md) (R-08).

## AI Usage Note

Drafted with Claude from the two reviews and the repository. Claude checked each remark against the code (logging, rate limiting, error codes, duplicated logic, token handling) and the requirements; Oleh reviewed the decisions.
