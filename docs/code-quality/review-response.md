# Response to the Code Review

How the team handled the review of this repository by the reviewing team (Lab 5): an in-class review written without AI, and a second review by an AI agent (OpenCode, model Muse Spark 1.3), both of commit `00fc939e21b03c1556817c53eb81f7f3f76a9185`, with the reviewers' comparison of the two. Issue: #147. Our own review of another team is in [`review-report.md`](review-report.md).

## How the feedback was processed

Every remark was checked against the code and the documents of the repository as they are now, not taken as stated. Each got one decision:

| Decision | Meaning |
|---|---|
| **Accepted** | The remark is right; the work goes into a follow-up issue. |
| **Already done** | Fixed or covered since the reviewed commit. |
| **Known, recorded** | We knew about it; it is written down and has a planned fix. |
| **Not accepted** | The remark does not hold; the reason is given. |

## What the reviewers praised

The code kept its shape after the review, and the checks that protect it stay in place: the layering rule in ESLint (`no-restricted-imports`) and the `@Endpoint` decorator, which keeps the framework out of the services; Argon2 and the same answer for an unknown phone and a wrong password (SEC-007); the end-to-end suite. Nothing to change.

## Remarks and decisions

| # | Remark | Source | Decision | What we found and what happens |
|---|---|---|---|---|
| R-01 | Too little logging: only the server start, unexpected `500`s and the stub's code are logged; no request log, no sign-in successes or failures, no admin actions. | Reviewers, AI (as a vulnerability combined with R-04) | **Accepted** | True. `Logger` is used in `main.ts`, `api-exception.filter.ts` and the console messaging stub only. SEC-004 requires a record of every sign-in (successful and failed) and every admin action, with no passwords, tokens or contacts in the output. The audit log comes with the database; a request log and sign-in events do not need it. Follow-up: **"Log requests and security events"** (`backend`). |
| R-02 | No session management and no revocation: tokens cannot be withdrawn on sign-out. | Reviewers | **Known, recorded** | True. Access tokens are signed JWTs valid 60 minutes with a `sessionId`, but nothing stores sessions, there is no sign-out endpoint, and a ban takes effect only when the token expires. SEC-005 asks for refresh tokens revoked on sign-out and on ban, so this is a gap against a requirement, not a new idea. It needs a sessions table, so it follows the database (#144). Follow-up: **"Sessions, refresh tokens and sign-out (SEC-005)"** (`backend`). |
| R-03 | Add isolated unit tests for the business logic, next to the end-to-end tests. | Reviewers, AI | **Already done** | The review was made before Lab 6. [`tests/unit/`](../../tests/unit/) now has unit tests with mocked repositories for the services, the date functions (`ageOn`, `kyivDate`, `addDays`), the match score and the auth adapters. See the [testing strategy](../testing/testing-strategy.md). |
| R-04 | No rate limiting; open to scraping and to guessing passwords and codes; with so little logging nobody would notice. | Reviewers, AI | **Known, recorded** | True: SA-04 in the [static analysis](static-analysis.md) is still open ("planned before deployment"), `429 RATE_LIMITED` is declared in the error format but nothing raises it, and SEC-007 sets the limits. The AI adds two details that we checked in `auth.service.ts`: a new code resets the failed-attempt counter (`register` creates a code with `failedAttempts: 0`), so one number allows 3 guesses a minute, about 4,300 a day, around 0.4% of a 6-digit space per day; and `POST /auth/guest` mints tokens without a limit. Both go into the follow-up. Follow-up: **"Rate limits and sign-in lockout (SEC-007, SEC-008)"** (`backend`), to be done before any deployment; its test is the one SEC-007 already describes (six bad sign-ins, then `429`). |
| R-05 | Magic numbers: field limits (`120`, `5000`, `2000`, `500`) written in several schemas. | AI | **Accepted** | Partly true. The limits are in `src/api/catalog/schemas/events.ts`, `listings/schemas/listings.ts` and `profiles/schemas/profiles.ts`; `120` is written for both the event and the listing title, and the event import (#211) now has to repeat the event limits so that an imported title can never be longer than the API allows. Each value is next to its `.describe()` text, which makes them readable, so this is a maintenance cost, not a defect. Follow-up: **"Name the field limits once"** (`refactor`): constants in `core/` used by the schemas and by the import adapter. |
| R-06 | `detailsFor` in `listings.service.ts` and `withDetails` in `profiles.service.ts` are duplicated join logic. | AI | **Not accepted** | Both are named after the same idea but do different work. `detailsFor` loads authors and categories for a list of listings in two parallel calls and returns a function; `withDetails` reads one account's date of birth and the interest list, computes the age and builds a different type. They share a pattern, not code, and a shared helper would need both modules' types. The reviewers also marked this remark as wrong. |
| R-07 | Error codes are kept in sync by hand in three places. | AI | **Not accepted** | Not true. `ErrorCode` in `api/common/schemas/errors.ts` is built from `domainErrorCodes` (`...domainErrorCodes`), so the schema follows `core/common/domain-error.ts` automatically. `errorStatus` in `api-exception.ts` is a `Record<ErrorCode, number>`, so a new code without a status does not compile. A new code means one edit in `core`, one line for its status, and the compiler points at the second. The reviewers also marked this remark as wrong. |
| R-08 | The validation log describes `PATCH /events/{id}`, the code has `PUT`. | AI | **Already done** | The log is the record of the Lab 4 run and is left as history, as [`progress.md`](progress.md) says; what was missing was a note in the log itself. A note now stands at the top of the validation log in [`quality-attributes.md`](../api/quality-attributes.md#4-validation-log). |
| R-09 | The dev server rewrites the committed spec on start (dirty diff); large committed Swagger UI files need manual syncing. | AI | **Known, recorded** | True and deliberate. The rewrite is development-only (`!isProduction`, see SA-02), and CI fails a pull request with a stale spec, so a forgotten commit is caught. The vendored Swagger UI under `docs/api/vendor/` is what GitHub Pages serves, and it changes only when the library is upgraded. We keep both. |
| R-10 | The MCP project uses `zod@3` and TypeScript 5.8, the API `zod@4` and 6.0; it uses `eval(jsonSchemaToZod)` and `any`; it is left out of Dependabot and ESLint. | AI | **Known, recorded** | `src/mcp/` is generated by openapi-mcp-generator and must not be edited by hand ([`AGENTS.md`](../../AGENTS.md)), so `eval`, `any` and the older versions come from the generator, which is pinned in `tools/mcp-generator/`. The schemas it evaluates come from our own spec, not from a request. It is left out of Dependabot on purpose (a comment in `.github/dependabot.yml` says so), because an upgrade there would be overwritten by the next generation. If the generator is upgraded, we re-check these points. |
| R-11 | Seeded accounts with a known password (including an admin) and the verification code printed to the console. | AI (side note) | **Known, recorded** | Both are in stubs that stand in for the database and the Telegram gateway: `src/infra/stubs/` is deleted as one folder in #144, and `ConsoleMessagingProvider` is replaced by the real messaging provider. Neither may reach a deployment; the follow-up of R-04 lists this as a condition for the first deployment. |
| R-12 | The pure functions `ageOn`, `kyiv-time.ts`, `checkTimes` and `isAtLeast` are covered only through the end-to-end tests. | AI | **Already done** | `ageOn`, `kyivDate` and `addDays` have their own tests; `checkTimes` is tested through `EventsService` (`EVENT_ENDS_BEFORE_START`), and `isAtLeast` through the age cases of `AuthService.verify`, including the leap-day birthday and the Kyiv midnight. |
| R-13 | `429 CODE_RESEND_TOO_SOON` and `409 CONFLICT` after a valid code reveal whether a number is registered. | AI (vulnerability) | **Partly accepted** | `429` appears for any number that asked for a code in the last minute, whether or not it has an account, so it tells nothing about registration. `409` comes only after a correct code, which only the owner of the number has. The remaining leak is small. We keep the answers as they are and note it in the follow-up of R-04, where the limits will change these paths anyway. |

## Where the reviewers' AI was wrong

The reviewers marked two remarks of the AI as wrong (R-06 and R-07), and our check agrees with both. Neither was a style opinion: one claims duplication that is not there, the other claims manual work that the compiler already does.

## Follow-up issues

To be opened by the Issue Tracker Lead, one per accepted or recorded item, with the `backend` area label:

1. **Log requests and security events** (R-01): request log without bodies or tokens, sign-in successes and failures with the phone masked, admin actions.
2. **Rate limits and sign-in lockout** (R-04, R-11, R-13): SEC-007 limits per token and per IP, lockout after 5 failed sign-ins, the attempt counter kept across new codes, a limit on `/auth/guest`. The stub accounts and the console code (R-11) are a condition for the first deployment, and the answers of R-13 are rechecked there.
3. **Sessions, refresh tokens and sign-out** (R-02): after the database (#144).
4. **Name the field limits once** (R-05), with the `refactor` label.

## What changed in the repository

- This document, linked from the [README](../../README.md).
- A note about `PATCH` and `PUT` in the validation log of [`quality-attributes.md`](../api/quality-attributes.md) (R-08).

## AI Usage Note

Drafted with Claude from the two reviews and the repository. Claude checked each remark against the code (logging, rate limiting, error codes, duplicated logic, token handling) and the requirements; Oleh reviewed the decisions.
