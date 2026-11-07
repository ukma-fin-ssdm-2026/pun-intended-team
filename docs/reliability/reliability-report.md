# Reliability Report

Fixes of the risks found in the [reliability scavenger hunt](scavenger-hunt.md), Lab 9.

## Findings

Severity rates the consequence if the failure happens, not how likely it is.

| ID | Finding | Severity | Reason | Status |
|---|---|---|---|---|
| [REL-01](scavenger-hunt.md#rel-01-database-calls-without-timeouts) | Database calls have no connection or statement timeout | High | One stuck query could exhaust the pool and stop the whole API, sign-in included. | Fixed (#367) |
| [REL-02](scavenger-hunt.md#rel-02-app-requests-without-a-timeout) | App requests have no timeout | Medium | A request could leave a screen loading forever on Android, but only that screen is affected. | Fixed (#367) |
| [REL-03](scavenger-hunt.md#rel-03-sign-out-dispatches-an-unhandled-navigation-action) | Sign-out dispatches a navigation action no navigator handles | Low | Only the navigation after sign-out is affected, and the user can navigate on their own. | Fixed (#367) |
| [REL-04](scavenger-hunt.md#rel-04-health-does-not-check-the-database) | `/health` answers "ok" without checking the database | High | A dead database goes unnoticed by the deploy rollback, the compose health gate and the uptime monitor, while every request that needs it fails. | Open |
| [REL-05](scavenger-hunt.md#rel-05-port-and-auth_rate_limit_per_minute-are-not-checked) | `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are not checked | High | The API becomes unreachable or refuses every sign-in. | Open |
| [REL-06](scavenger-hunt.md#rel-06-a-failed-nightly-backup-skips-the-day) | A failed nightly backup skips the day without notice | Medium | The day has no backup and nobody is told. | Open |
| [REL-07](scavenger-hunt.md#rel-07-profile-edit-hides-the-more-button-when-interests-fail-to-load) | Profile edit hides the "more" button when interests fail to load | Low | One optional list is missing and the rest of the screen works. | Open |
| [REL-08](scavenger-hunt.md#rel-08-a-lost-refresh-response-ends-the-session) | A lost refresh response ends the session | Medium | The user is signed out of the account and has to sign in again. | Open |
| [REL-09](scavenger-hunt.md#rel-09-a-google-key-fetch-failure-answers-500) | A Google key fetch failure answers 500 instead of 503 | Low | Sign-in fails either way; only the status the app could retry on is wrong. | Open |
| [REL-10](scavenger-hunt.md#rel-10-the-rollback-runs-old-code-on-a-migrated-database) | The automatic rollback runs the old image on migrated data | High | The API can run against a schema it does not match while the deploy reports a successful rollback. | Open |
| [REL-11](scavenger-hunt.md#rel-11-importfrom-loses-the-cause-when-finishrun-throws) | `importFrom()` loses the cause when `finishRun` throws | Low | The cause of a failed import is lost and the run stays marked `running`; no user is affected. | Open |
| [REL-12](scavenger-hunt.md#rel-12-any-refresh-error-other-than-401-reads-as-no-connection) | Any refresh error other than 401 reads as "no connection" | Low | The message is misleading, but the user's data and session are not harmed. | Open |
| [REL-14](scavenger-hunt.md#rel-14-karabas-pages-without-usable-json-ld-give-a-succeeded-run) | Karabas pages without usable JSON-LD give a succeeded run with 0 events | Medium | New and changed Karabas events stop arriving while every run is recorded as succeeded; the events imported earlier stay in the catalog. | Open |

## REL-01: Database Calls Without Timeouts

**Fault:** the API's pg pool was created from a connection string alone, so every pg default applied: wait for a connection forever (`connectionTimeoutMillis: 0`), no `statement_timeout`, no `query_timeout`. **Failure:** a locked table, a full pool or a database that accepts the connection and stops answering kept requests open with no limit and no log line. Once the 10 pool connections were taken, the whole API hung, sign-in included.

### Before

```ts
// src/infra/prisma/prisma.service.ts
super({ adapter: new PrismaPg({ connectionString }) });
```

```ts
// src/api/common/api-exception.filter.ts: anything unexpected is a 500
const { status, code, message, details } = toApiException(exception) ?? this.unexpected(exception);
```

### After

```ts
// src/infra/prisma/prisma.service.ts
super({ adapter: new PrismaPg(databasePoolConfig(connectionString, loadDatabaseTimeouts())) });
```

```ts
// src/infra/prisma/database-timeouts.ts
export function databasePoolConfig(connectionString: string, timeouts: DatabaseTimeouts): PoolConfig {
  return {
    connectionString,
    connectionTimeoutMillis: timeouts.connectMs,
    statement_timeout: timeouts.statementMs,
    lock_timeout: timeouts.lockMs,
    idle_in_transaction_session_timeout: timeouts.idleInTransactionMs,
    query_timeout: timeouts.statementMs + QUERY_TIMEOUT_MARGIN_MS,
  };
}
```

```ts
// src/api/common/api-exception.filter.ts
const { status, code, message, details } =
  toApiException(exception) ?? this.unavailable(exception) ?? this.unexpected(exception);

private unavailable(exception: unknown): ApiException | undefined {
  if (!this.isUnavailable(exception)) {
    return undefined;
  }
  const error = exception as Error;
  this.logger.error(`A dependency timed out: ${error.message}`, error.stack);
  return new ApiException('SERVICE_UNAVAILABLE', 'The service is temporarily unavailable. Try again later');
}
```

```ts
// src/api/app.module.ts: the only api file allowed to import infra (code-structure.md, rule 1)
{
  provide: APP_FILTER,
  useFactory: (adapterHost: HttpAdapterHost) => new ApiExceptionFilter(adapterHost, isDatabaseTimeout),
  inject: [HttpAdapterHost],
},
```

The limits come from the environment, are checked at startup like the rest of the config (the server refuses to start on a value that is not a positive integer, or on a lock timeout above the statement timeout) and are listed in [`.env.example`](../../.env.example) and the [README](../../README.md):

| Variable | Default | pg / Postgres setting | Error when it fires |
|---|---|---|---|
| `DATABASE_CONNECT_TIMEOUT_MS` | 5 s | `connectionTimeoutMillis`: wait for a free pool connection, or for a new connection to start | `timeout exceeded when trying to connect`, `Connection terminated due to connection timeout` |
| `DATABASE_STATEMENT_TIMEOUT_MS` | 10 s | `statement_timeout`, enforced by Postgres | Prisma `P2039` with Postgres `57014` (`query_canceled`) |
| — | statement + 1 s | `query_timeout`, enforced by the client, for a server that does not answer at all | `Query read timeout` |
| `DATABASE_LOCK_TIMEOUT_MS` | 3 s | `lock_timeout`, enforced by Postgres | Prisma `P2039` with Postgres `55P03` (`lock_not_available`) |
| `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS` | 15 s | `idle_in_transaction_session_timeout`: ends a session idle in an open transaction, so it cannot hold locks | The session is closed |

`query_timeout` is kept just above `statement_timeout` on purpose: normally Postgres cancels the statement first and frees its locks and the connection cleanly. The client limit only fires when the server has stopped answering.

### Patterns Applied

- **Timeouts on every external call.** A pool checkout, a statement and a lock wait each have an upper bound, so no request can wait on the database forever.
- **Narrow error mapping.** [`isDatabaseTimeout`](../../src/infra/prisma/database-timeouts.ts) accepts only those timeout errors: the three pg messages above and `P2039` with `57014` or `55P03`. Any other database error, a refused connection or a bug stays a logged `500 INTERNAL_ERROR`, so real defects are not hidden behind a "try again later". The check lives in `infra`, which knows pg and Prisma. The existing `ApiExceptionFilter` gets it from `app.module.ts`, so `api` still does not import `infra` and the filter stays the only place that builds an error body.
- **Logging.** Every timeout is logged as an error with its cause and stack (`A dependency timed out: Query read timeout`). Before, nothing was thrown and nothing was logged.

### Fail Fast or Fail Safe

The chosen reaction is to **fail fast**: the request ends with an error as soon as its limit runs out, and nothing is retried.

- A **safe failure** with a fallback answer is not possible here: there is no cache or second copy of the accounts, profiles or categories to serve from. Showing an empty or stale list as if it were the real answer would mislead the user, and for writes there is no safe stand-in at all.
- **Retries** would make an overload worse. Each retry takes another pool connection while the database is already slow, and retrying a write whose outcome is unknown (the server may have committed before the client gave up) risks doing it twice. The client can retry a `503` itself, later.
- Failing fast frees the request and its pool connection within seconds, so one slow table does not take down the endpoints that do not use it.

### What the User Sees

Before: the app's spinner never stops. The request stays open until the client or a proxy gives up, and the API logs nothing.

After: within the limit (at most about 11 s with the defaults, usually 3–5 s for a lock or a full pool) the app gets:

```http
HTTP/1.1 503 Service Unavailable

{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "The service is temporarily unavailable. Try again later" } }
```

The body never contains the SQL, the model name or the Postgres message; those go only to the log. The app can branch on `SERVICE_UNAVAILABLE` and offer to try again ([API design](../api/api-design.md#errors)).

### Recovery

No manual action is needed. When Postgres cancels a statement, the connection goes back to the pool and serves the next request. A connection that never got going is dropped and replaced by a new one on the next checkout. As soon as the lock is released or the database answers again, the next request succeeds. The fault-injection test checks this: 15 requests in a row, more than the pool's 10 connections, each answer within the connect timeout.

### Verification

- [`tests/reliability/database-timeouts.reliability.test.ts`](../../tests/reliability/database-timeouts.reliability.test.ts) (`npm run test:reliability`) starts the built API against a fake Postgres on a local socket. It reproduces the fault from the client's side without a real lock:
  - the fake accepts the connection and never answers the startup: `503` within the connect timeout, cause logged;
  - the fake completes the startup and never answers a query (what a locked table looks like): `503` after the statement timeout and before the query timeout, cause logged;
  - the fake answers with Postgres's `57014`: `503`, no database error in the body;
  - 15 requests in a row after timeouts all answer at once: the pool gives its connections back.

  With the old `new PrismaPg({ connectionString })` the first two tests are still waiting when their 12 s guard aborts them, which is the hang REL-01 describes.
- [`tests/unit/database-timeouts.test.ts`](../../tests/unit/database-timeouts.test.ts) checks the defaults, that every variable reaches the pool config, that invalid values stop the start, and which errors count as a timeout.
- [`tests/unit/api-exception.filter.test.ts`](../../tests/unit/api-exception.filter.test.ts) checks the `503` body, the log line, and that other errors keep their status.

### Open Issues

- **Migrations can still queue behind a backup.** `deploy/deploy-staging.sh` runs `migrate` while the previous API version still serves. The pre-deploy backup runs to the end before it, but the nightly `pg_dump` of `deploy/backup-db.sh` can overlap a deploy. An `ALTER TABLE` then waits for the dump's lock, and the API's queries on that table queue behind the `ALTER`. The API now gives up after `DATABASE_LOCK_TIMEOUT_MS` and answers `503` instead of hanging, but the table stays unusable until the dump ends. Suggested fix, not made here: run migrations with a short `lock_timeout` (for example `PGOPTIONS='-c lock_timeout=5s'` on the `migrate` service), so a migration that cannot get its lock fails and the deploy stops with the previous version still serving.
- **The import service has no limits yet.** `ImportPrismaService` still uses the pg defaults. It serves no HTTP request, so a hang does not block users, but a stuck run never ends. Its statements may legitimately run longer, so it needs limits of its own.
- **No real-database lock test.** The fault-injection test uses a fake server, so `statement_timeout` and `lock_timeout` are checked as settings passed to pg (unit test) and by the error Postgres sends (fake), not against a real `LOCK TABLE`. A test in `tests/e2e/` that holds `LOCK TABLE categories IN ACCESS EXCLUSIVE MODE` in a second connection would close the gap.
- **The limit is per database call, not per request.** A request that makes several queries can take several limits in total. No endpoint makes more than a few, but there is no overall request deadline.
- **No `Retry-After` header** on the `503`; the app decides on its own when to retry.

## REL-02: App Requests Without a Timeout

**Fault:** the app's two API clients, `apiClient` (the account's or the guest's requests) and `publicClient` (the auth endpoints, the session renewal and the guest token), were created without a `fetch` of their own, so every request used `fetch` with no time limit, and React Native on Android sets none of its own. **Failure:** a request to a server that accepts the connection and stops answering never settled, and the screen waiting for it stayed in its loading state with no error and no way to retry.

### Before

```ts
// app/src/api/client.ts
export const apiClient = createClient<paths>({ baseUrl: config.apiUrl });
```

```ts
// app/src/api/public-client.ts
export const publicClient = createClient<paths>({ baseUrl: config.apiUrl });
```

### After

```ts
// app/src/api/fetch-with-timeout.ts
const REQUEST_TIMEOUT_MS = 15 * 1000;

export function fetchWithTimeout(request: Request): Promise<Response> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(request, { signal: controller.signal });
}
```

```ts
// app/src/api/client.ts
export const apiClient = createClient<paths>({ baseUrl: config.apiUrl, fetch: fetchWithTimeout });
```

```ts
// app/src/api/public-client.ts
export const publicClient = createClient<paths>({ baseUrl: config.apiUrl, fetch: fetchWithTimeout });
```

### Patterns Applied

- **Timeouts on every external call.** These two clients are the only ones in the app, so every request, the session renewal and the guest token included, is aborted after 15 s. The limit is one constant in one file.
- **The outer limit is longer than the inner one.** The API answers a database timeout with `503` after at most about 11 s with the defaults (REL-01), so the app usually gets the API's answer before its own limit runs out.
- **Abort through `AbortController`.** React Native's `AbortSignal` has no `timeout()`, so `fetchWithTimeout` aborts with its own timer. The timer is not cleared when `fetch` resolves, so the abort also covers reading the body.
- **The existing failure path.** No new error handling was needed: the aborted `fetch` rejects, `openapi-fetch` rethrows it, and `call()` in `public-client.ts` already turns a thrown error into `{ ok: false, status: 0 }`, which the screens already handle.

### Fail Fast or Fail Safe

The chosen reaction is to **fail fast**: after 15 s the request ends with an error, and the app does not retry it on its own.

- A **safe failure** would show something in place of the answer, but an empty list or old data shown as the answer would mislead the user, and for an action such as saving the profile there is no stand-in at all.
- An **automatic retry** is not safe here: a request that timed out may still have reached the server. For the session renewal this is the case of REL-08: the server has already rotated the refresh token, and a retry with the old one ends the session.
- The user decides when to try again, for example with the catalog's retry button.

### What the User Sees

Before: the screen's spinner never stops, and nothing says what went wrong.

After: within 15 s the request ends with status `0`, the same as with no network:

- the catalog shows the notice "Не вдалося завантажити події" with "Перевір зʼєднання з інтернетом і спробуй ще раз." and a "Спробувати ще раз" button;
- the hooks that load data (`use-categories.ts`, `use-event.ts`, `use-events.ts`, `use-interests.ts`) report "Could not reach the server.";
- screens that use `failureSnackbar` show "Немає з’єднання" with "Перевір інтернет".

`useApiQuery` sets `loading` to false once the failure arrives, so the spinner stops.

### Recovery

No manual action is needed beyond trying again. An aborted request leaves no state behind: `useApiQuery`'s `reload()`, which the catalog's retry button calls, loads again; a failed guest token is not cached, so the next request asks for a new one; and `renewal` is cleared in `finally`, so the next request renews the session again.

### Verification

- The app has no test runner (`app/package.json` has no `test` script), so no automated test covers `fetchWithTimeout` yet; the reliability tests are added in #385.
- Checked in the code: `apiClient` and `publicClient` are the only `createClient` calls in `app/src`, both pass `fetch: fetchWithTimeout`, and `fetchWithTimeout` is the only direct `fetch` call. `openapi-fetch` rethrows an error from `fetch` when no middleware handles it with `onError`, and `call()` turns it into status `0`.

### Open Issues

- **A timeout reads as "no connection".** `call()` returns status `0` for any thrown error, so the user is told to check the internet even when the server is reachable but slow.
- **A timed-out renewal can still end the session.** If the server rotated the refresh token and the response is aborted, the app keeps the old token (REL-08). The timeout makes this more likely than before, when the request waited.
- **The limit is fixed in code.** `REQUEST_TIMEOUT_MS` is the same for every request and cannot be changed without a new build.

## REL-03: Sign-Out Dispatches an Unhandled Navigation Action

**Fault:** the sign-out handlers of the profile and organization settings screens called `router.dismissAll()` every time, also when there was no screen to dismiss. expo-router then dispatches `POP_TO_TOP`, and no navigator handles it. **Failure:** in a development build the action is reported as an error, "The action 'POP_TO_TOP' was not handled by any navigator."; in a release build it is dropped without a message. The sign-out itself went on: `router.replace('/onboarding')` is dispatched after it.

### Before

```tsx
// app/src/app/(tabs)/profile.tsx
void signOut();
// Signing out starts a new history on the onboarding, so back cannot return to the account.
router.dismissAll();
router.replace('/onboarding');
```

```tsx
// app/src/app/organization/settings.tsx
void signOut();
// As on П5: signing out starts a new history on the onboarding (В1).
router.dismissAll();
router.replace('/onboarding');
```

### After

```tsx
// app/src/app/(tabs)/profile.tsx, and the same in app/src/app/organization/settings.tsx
void signOut();
// Signing out starts a new history on the onboarding, so back cannot return to the account.
if (router.canDismiss()) router.dismissAll();
router.replace('/onboarding');
```

### Patterns Applied

- **Guard clause.** `router.canDismiss()` walks the active navigation state and is true only when a stack in it has more than one screen. `dismissAll()` is called only then, so the action it dispatches always has a navigator to handle it.

### Fail Fast or Fail Safe

The chosen reaction is to **fail safe**: when there is nothing to dismiss, the step is skipped and the sign-out goes on.

- Dismissing the screens only clears the history so that back cannot return to the account. With no screen to dismiss there is no such history, so skipping the step loses nothing.
- **Failing fast** would stop the sign-out the user asked for, over a step that had nothing to do.

### What the User Sees

Before: after "sign out", the onboarding opens. In a development build an error about the unhandled `POP_TO_TOP` is also logged with `console.error`; the message itself says it is shown only in development. In a release build nothing is shown.

After: the onboarding opens, and no error is logged in either build.

### Recovery

No recovery is needed: the unhandled action changed no state, and each sign-out checks `canDismiss()` again.

### Verification

- No automated test covers it: the app has no test runner (`app/package.json` has no `test` script).
- Checked in the code: both sign-out handlers call `dismissAll()` only after `canDismiss()`. In expo-router 57, `dismissAll()` adds `POP_TO_TOP` to the routing queue, and the unhandled-action handler of `ExpoRoot` logs it with `console.error` outside production and does nothing in production.

### Open Issues

- **The handler is written twice.** The same three lines are in `profile.tsx` and `organization/settings.tsx`, so a later change has to be made in both.
- **`signOut()` is not awaited.** The onboarding opens before the session is ended locally; the request to the API that comes first can take up to the app's 15 s timeout (REL-02).

## Open Findings

- **REL-04:** being fixed in #384.
- **REL-05:** being fixed in #384.
- **REL-06:** not picked for this lab's fixes; proposed: remove the `.partial` file and log the failure instead of letting `set -e` end the script, and check each dump with `pg_restore --list`.
- **REL-07:** Low, since the rest of the screen works; proposed: show `interests.error` with a retry, for example by loading interests through `useApiQuery` as `useCategories` does, which gives a `reload()`.
- **REL-08:** not fixed now because the fix changes how the server detects a stolen refresh token; proposed: keep the hash of the replaced token for a short grace period and treat its reuse within it as a repeated request, not a theft.
- **REL-09:** Low, since sign-in fails either way; proposed: pass a check for the key-fetch errors to `ApiExceptionFilter` in `app.module.ts` next to `isDatabaseTimeout`, so they answer `503`.
- **REL-10:** being fixed in #384.
- **REL-11:** Low, since no user request is affected; proposed: guard `finishRun` in the `catch` of `importFrom()`, log its error and rethrow the original one.
- **REL-12:** Low, since only the message is wrong; proposed: let `renew` throw an error with the response status and let `call()` report that status instead of `0`.
- **REL-14:** not fixed in this lab; proposed: a warning for each section page with no events in its JSON-LD, and an error that fails the run when no section has any (fail fast). The events have to be counted before the catalog window filter, since a section can rightly have no events in the window (the unit test "leaves out the events after the catalog window").

## Reliability Tests

_To be added from #385._

## Bonuses

_To be added from #388, #389 and #390._

## AI Usage Note

The fix, its tests and this report were generated with Claude Code from the scavenger-hunt finding. Verified by running the unit and fault-injection tests, by checking that the fault-injection tests hang without the fix, and by checking the errors pg and Prisma throw against a fake Postgres. To be reviewed by the team.
