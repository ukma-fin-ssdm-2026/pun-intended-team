# Reliability Report

Fixes of the risks found in the [reliability scavenger hunt](scavenger-hunt.md), Lab 9.

## Findings

Severity rates the consequence if the failure happens, not how likely it is. It is the severity of the finding as found; for a mitigated finding, what is left is described in its section. **Fixed** means the failure in the finding can no longer happen; **Mitigated** means it is less likely or no longer silent, but can still happen.

| ID | Finding | Severity | Reason | Status |
|---|---|---|---|---|
| [REL-01](scavenger-hunt.md#rel-01-database-calls-without-timeouts) | Database calls have no connection or statement timeout | High | One stuck query could exhaust the pool and stop the whole API, sign-in included. | Fixed (#367) |
| [REL-02](scavenger-hunt.md#rel-02-app-requests-without-a-timeout) | App requests have no timeout | Medium | A request could leave a screen loading forever on Android, but only that screen is affected. | Fixed (#367) |
| [REL-03](scavenger-hunt.md#rel-03-sign-out-dispatches-an-unhandled-navigation-action) | Sign-out dispatches a navigation action no navigator handles | Low | Sign-out still reaches the onboarding; the only effect is an error logged in development builds. | Fixed (#367) |
| [REL-04](scavenger-hunt.md#rel-04-health-does-not-check-the-database) | `/health` answers "ok" without checking the database | High | A dead database goes unnoticed by the deploy rollback, the compose health gate and the uptime monitor, while every request that needs it fails. | Fixed (#399) |
| [REL-05](scavenger-hunt.md#rel-05-port-and-auth_rate_limit_per_minute-are-not-checked) | `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are not checked | High | The API becomes unreachable or refuses every sign-in. | Fixed (#425) |
| [REL-06](scavenger-hunt.md#rel-06-a-failed-nightly-backup-skips-the-day) | A failed nightly backup skips the day without notice | Medium | The day has no backup and nobody is told. | Fixed (#398) |
| [REL-07](scavenger-hunt.md#rel-07-profile-edit-hides-the-more-button-when-interests-fail-to-load) | Profile edit hides the "more" button when interests fail to load | Low | One optional list is missing and the rest of the screen works. | Fixed (#398) |
| [REL-08](scavenger-hunt.md#rel-08-a-lost-refresh-response-ends-the-session) | A lost refresh response ends the session | Medium | The user is signed out of the account and has to sign in again. | Mitigated (#398) |
| [REL-09](scavenger-hunt.md#rel-09-a-google-key-fetch-failure-answers-500) | A Google key fetch failure answers 500 instead of 503 | Low | Sign-in fails either way; only the status the app could retry on is wrong. | Fixed (#511) |
| [REL-10](scavenger-hunt.md#rel-10-the-rollback-runs-old-code-on-a-migrated-database) | The automatic rollback runs the old image on migrated data | High | The API can run against a schema it does not match while the deploy reports a successful rollback. | Mitigated (#398) |
| [REL-11](scavenger-hunt.md#rel-11-importfrom-loses-the-cause-when-finishrun-throws) | `importFrom()` loses the cause when `finishRun` throws | Low | The cause of a failed import is lost and the run stays marked `running`; no user is affected. | Open |
| [REL-12](scavenger-hunt.md#rel-12-any-refresh-error-other-than-401-reads-as-no-connection) | Any refresh error other than 401 reads as "no connection" | Low | The message is misleading, but the user's data and session are not harmed. | Fixed (#511) |
| [REL-14](scavenger-hunt.md#rel-14-karabas-pages-without-usable-json-ld-give-a-succeeded-run) | Karabas pages without usable JSON-LD give a succeeded run with 0 events | Medium | New and changed Karabas events stop arriving while every run is recorded as succeeded; the events imported earlier stay in the catalog. | Mitigated (#511) |

Each fix below starts from one question (§3.1 of the lecture): which is worse in this place, a wrong answer or no answer? A wrong answer being worse calls for failing fast, no answer being worse for failing safe. Where one call gets a timeout, retries and a fallback, they are stacked in the order of §3.5: the timeout on each attempt, bounded retries over it, and the way out once the retries are spent.

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
  this.logger.error(`A dependency is unavailable: ${error.message}`, error.stack);
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

The limits come from the environment, are checked at startup like the rest of the config and are listed in [`.env.example`](../../.env.example) and the [README](../../README.md). The server refuses to start on a value that is not a positive integer, on a value above one day (added in #405, after the boundary test found that a longer value broke every database call), or on a lock timeout above the statement timeout.

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
- **Input check at startup.** Each limit must be a positive integer of at most one day, so a typo stops the start instead of giving a pool that fails every call.
- **Logging.** Every timeout is logged as an error with its cause and stack (`A dependency is unavailable: Query read timeout`; "timed out" until #511 widened it to REL-09). Before, nothing was thrown and nothing was logged.

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

- [`tests/reliability/database-timeouts.reliability.test.ts`](../../tests/reliability/database-timeouts.reliability.test.ts) (fault injection) starts the built API against a fake Postgres on a local socket. It reproduces the fault from the client's side without a real lock:
  - the fake accepts the connection and never answers the startup: `503` within the connect timeout, cause logged;
  - the fake completes the startup and never answers a query (what a locked table looks like): `503` after the statement timeout and before the query timeout, cause logged;
  - the fake answers with Postgres's `57014`: `503`, no database error in the body;
  - 15 requests in a row after timeouts all answer at once: the pool gives its connections back.
- [`tests/reliability/error-handling.reliability.test.ts`](../../tests/reliability/error-handling.reliability.test.ts) (error handling) checks the other side of the narrow mapping: a refused connection is not a timeout, so it stays a `500` with the generic body, and the API keeps answering.
- [`tests/reliability/database-timeout-settings.reliability.test.ts`](../../tests/reliability/database-timeout-settings.reliability.test.ts) (boundary) starts the API with edge values of `DATABASE_STATEMENT_TIMEOUT_MS`.
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
- An **automatic retry** is not safe in general: a request that timed out may still have reached the server. The one exception is the session renewal, which the server made safe to repeat within 60 s, so only it is retried ([REL-08](#rel-08-a-lost-refresh-response-ends-the-session)).
- The user decides when to try again, for example with the catalog's retry button.

### What the User Sees

Before: the screen's spinner never stops, and nothing says what went wrong.

After: within 15 s the request ends with status `0`, the same as with no network:

- the catalog shows the notice "Не вдалося завантажити події" with "Перевір зʼєднання з інтернетом і спробуй ще раз." and a "Спробувати ще раз" button;
- the hooks that load data (`use-categories.ts`, `use-event.ts`, `use-events.ts`) report "Could not reach the server.";
- the interest picker shows "Повторити" in place of "+ ще" ([REL-07](#rel-07-profile-edit-hides-the-more-button-when-interests-fail-to-load));
- screens that use `failureSnackbar` show "Немає з’єднання" with "Перевір інтернет".

`useApiQuery` sets `loading` to false once the failure arrives, so the spinner stops.

### Recovery

No manual action is needed beyond trying again. An aborted request leaves no state behind: `useApiQuery`'s `reload()`, which the catalog's retry button calls, loads again; a failed guest token is not cached, so the next request asks for a new one; and `renewal` is cleared in `finally`, so the next request renews the session again.

### Verification

- [`tests/reliability/request-timeout.reliability.test.ts`](../../tests/reliability/request-timeout.reliability.test.ts) (fault injection, added in #405) runs the app's `fetchWithTimeout` against a fake API on a local port: a request with no answer is aborted after 15 s and not before, a body that stops in the middle is aborted after 15 s, and a dropped connection fails at once. The 15 s run on mock timers.
- Checked in the code: `apiClient` and `publicClient` are the only `createClient` calls in `app/src`, both pass `fetch: fetchWithTimeout`, and `fetchWithTimeout` is the only direct `fetch` call. `openapi-fetch` rethrows an error from `fetch` when no middleware handles it with `onError`, and `call()` turns it into status `0`.

### Open Issues

- **A timeout reads as "no connection".** `call()` returns status `0` for any thrown error, so the user is told to check the internet even when the server is reachable but slow.
- **A timed-out renewal can still end the session after a long outage**; see the Open Issues of [REL-08](#rel-08-a-lost-refresh-response-ends-the-session).
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

- No automated test covers it: the app's Jest tests do not include the sign-out.
- Checked in the code: both sign-out handlers call `dismissAll()` only after `canDismiss()`. In expo-router 57, `dismissAll()` adds `POP_TO_TOP` to the routing queue, and the unhandled-action handler of `ExpoRoot` logs it with `console.error` outside production and does nothing in production.

### Open Issues

- **The handler is written twice.** The same three lines are in `profile.tsx` and `organization/settings.tsx`, so a later change has to be made in both.
- **`signOut()` is not awaited.** The onboarding opens before the session is ended locally; the request to the API that comes first can take up to the app's 15 s timeout (REL-02).

## REL-04: `/health` Does Not Check the Database

**Fault:** `getHealth` returned `{ status: 'ok' }` without touching the database, and `PrismaService` connects only on the first query. **Failure:** an API that could not reach its database reported "ok" to the three consumers of `/health`: the Dockerfile's `HEALTHCHECK`, which decides the deploy's rollback; the `service_healthy` gate in `docker-compose.staging.yml`; and the uptime monitor of NFR REL-001.

### Before

```ts
// src/api/system/controllers/system.controller.ts
getHealth(): HealthResponse {
  return { status: 'ok' };
}
```

### After

```ts
// src/core/system/services/health.service.ts
// Below the 3 s timeout of the HEALTHCHECK in the Dockerfile, so Docker gets the answer instead of giving up.
export const HEALTH_CHECK_TIMEOUT_MS = 2 * SECOND_MS;

async check(): Promise<Health> {
  const database = await this.probe('database', () => this.database.ping());
  return { status: database === 'up' ? 'healthy' : 'unhealthy', checks: { database } };
}

/** The cause of a failure goes to the log only, never to the answer. */
private async probe(name: string, ping: () => Promise<void>): Promise<DependencyStatus> {
  // ...
  try {
    await Promise.race([ping(), timeout]);
    return 'up';
  } catch (error) {
    this.logger.error(`Health check: the ${name} is down: ${cause}`);
    return 'down';
  }
  // ...
}
```

```ts
// src/infra/prisma/prisma-database-probe.ts: the same pool, role and REL-01 limits as real requests
async ping(): Promise<void> {
  await this.prisma.$queryRaw`SELECT 1`;
}
```

```ts
// src/api/system/controllers/system.controller.ts
const health = await this.health.check();
if (health.status === 'unhealthy') {
  res.status(HttpStatus.SERVICE_UNAVAILABLE);
}
return health;
```

The Dockerfile's `HEALTHCHECK` is unchanged: it already failed on any status that is not 2xx, so the rollback and the compose gate react to the `503` with no change to the deploy.

### Patterns Applied

- **A health check of the critical dependency.** `SELECT 1` through the same pool as the requests, so it fails whenever they would.
- **A timeout below the caller's.** 2 s, under the 3 s of the `HEALTHCHECK`, so Docker gets an "unhealthy" answer instead of a timeout of its own.
- **Ports and adapters.** `HealthService` in `core` knows only the `DatabaseProbe` port; the Prisma adapter is in `infra` ([code structure](../architecture/mechanisms/code-structure.md)).
- **Logging, with no details in the answer.** The cause goes to the log; the body says only which dependency is down.

### Fail Fast or Fail Safe

The chosen reaction is to **fail fast**: `/health` answers `503 unhealthy` as soon as the database fails or stays silent for 2 s.

- Here a **wrong answer is worse than none**: "healthy" while the database is dead is exactly the failure of the finding, since every consumer then trusts an API that cannot serve data.
- Failing fast turns the dead database into a signal the deploy already acts on: a new version that cannot reach the database is rolled back.

### What the User Sees

- **Users:** during a deploy whose new version cannot reach the database, nothing changes: the rollback keeps the previous version serving. When the database itself is down, requests fail as before, with `503` for a timeout (REL-01) or `500` for a refused connection; the health check does not hide or change that.
- **Operators:** `docker compose ps` shows the API as unhealthy, the deploy job fails and rolls back, and the log has `Health check: the database is down: …`. The uptime monitor counts the time as down.

### Recovery

Automatic. As soon as `SELECT 1` answers again, `/health` answers `200` and the next `HEALTHCHECK` marks the container healthy. A deploy that was rolled back is deployed again by hand once the database is fixed.

### Verification

- [`tests/reliability/health-check.reliability.test.ts`](../../tests/reliability/health-check.reliability.test.ts) (fault injection) starts the built API with a database that refuses the connection and with one that never answers. In both cases `/health` answers `503 unhealthy` with `database: down` within the limit, without the cause in the body, and the Dockerfile's own `HEALTHCHECK` command exits 1.
- [`tests/unit/health.service.test.ts`](../../tests/unit/health.service.test.ts): healthy, failed and silent database.

### Open Issues

- **One dependency only.** The external providers of the import are not checked; they are not on the request path, so they should not make the API unhealthy.
- **The API is not restarted when it turns unhealthy at run time.** Docker Compose marks it unhealthy, but restarts a container only when it exits. The health check decides deploys and alerts the uptime monitor; it does not restart anything.

## REL-05: `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` Are Not Checked

**Fault:** `config.ts` read both with `Number(process.env.X ?? default)`. `??` replaces only an unset variable, and `Number('')` is `0`. **Failure:** an empty `AUTH_RATE_LIMIT_PER_MINUTE` gave a limit of 0, so `ThrottlerGuard` refused every Google registration, sign-in and refresh as `429`; an empty `PORT` gave port 0, a random one; any other bad value started the API with it or failed with Node's own error, which does not name the variable.

### Before

```ts
// src/api/common/config.ts
export const port = Number(process.env.PORT ?? DEFAULT_PORT);
export const authRateLimitPerMinute = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 20);
```

### After

```ts
// src/api/common/config.ts
function readInteger(name: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a whole number of at least ${min}, got "${value}"`);
  }
  if (Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be a whole number from ${min} to ${max}, got "${value}"`);
  }
  return Number(value);
}

export const port = readInteger('PORT', DEFAULT_PORT, 1, 65535);
export const authRateLimitPerMinute = readInteger('AUTH_RATE_LIMIT_PER_MINUTE', 20, 1);
```

`config.ts` is read when the API starts, so a thrown error stops the start with exit code 1.

### Patterns Applied

- **Validation of the configuration at startup**, the same way as the database limits of REL-01: an unset or empty value takes the default, anything but a whole number in range is refused.
- **An error that names the variable and quotes the value**, so the log says what to fix.

### Fail Fast or Fail Safe

Both, by the kind of value.

- **An empty value fails safe:** it is the usual typo in `.env` and has an obvious meaning, so it takes the default instead of 0.
- **Any other bad value fails fast.** Here a **wrong answer is worse than none**: an API on the wrong port or with a limit of 0 starts and looks healthy, while a refused start is seen at once and, in a deploy, rolled back.

### What the User Sees

- **Users:** nothing. A bad value never reaches a running API, so sign-in keeps its limit of 20 requests per minute and the app finds the API on its port.
- **Operators:** the API exits at start with, for example, `AUTH_RATE_LIMIT_PER_MINUTE must be a whole number of at least 1, got "abc"`. In a deploy, the container does not turn healthy and the deploy rolls back.

### Recovery

Manual: fix the value in `.env` and start the API again.

### Verification

- [`tests/reliability/port-and-rate-limit-settings.reliability.test.ts`](../../tests/reliability/port-and-rate-limit-settings.reliability.test.ts) (boundary) starts the built API: it stops with exit code 1 and a message naming the variable on `PORT` `0`, `-1`, `abc`, `70000` and `1.5`, and on `AUTH_RATE_LIMIT_PER_MINUTE` `0`, `-5`, `abc` and `1.5`; with an empty limit the first sign-in request is not refused; a limit of `1` starts the API.
- The shared start check moved into [`api-process.ts`](../../tests/reliability/api-process.ts), so the REL-01 boundary test uses it as well.

### Open Issues

- **An empty `PORT` is not tested.** It takes the default by the same code as the empty limit.
- **The Dockerfile's `HEALTHCHECK` reads `PORT` on its own**, with `??`, so with an empty `PORT` it calls port 80 while the API listens on 4100. The container turns unhealthy and the deploy rolls back, so the failure is loud, not silent.

## REL-06: A Failed Nightly Backup Skips the Day

**Fault:** under `set -e`, a failed `pg_dump` ended the script and left its `.partial` file, and nothing checked that a copy could be read back. **Failure:** the container restarted after 01:00, so the loop waited for the next night; that day had no backup and nobody was told.

### Before

```sh
# deploy/backup-db.sh
pg_dump --format=custom --file="$file.partial"
mv "$file.partial" "$file"
```

### After

```sh
# deploy/backup-db.sh, in dump()
# A run that was killed leaves its .partial; only this folder's, since a deploy's `now` can run during the night.
rm -f "$backups/$1"/*.partial
# ...
timeout 15m pg_dump --format=custom --lock-wait-timeout=5min --file="$file.partial" 2>"$log" || status=$?
if [ "$status" -eq 0 ]; then
  step=restore
  pg_restore --list "$file.partial" >/dev/null 2>"$log" || status=$?
fi
```

```sh
# deploy/backup-db.sh, in nightly()
until dump daily; do
  if [ "$attempt" -ge "$attempts" ]; then
    echo "The nightly backup failed $attempts times; the next one starts at 01:00 UTC" >&2
    echo "$(date -u +%FT%TZ) $reason" >"$failed_marker"
    record false '' "$reason"
    return 1
  fi
  echo "Retrying the backup in $retry_delay s" >&2
  attempt=$((attempt + 1))
  sleep "$retry_delay"
done
```

Each night is one row in the new `backup_runs` table: date, result, attempts, duration, size, and the reason as one of `unreachable`, `auth_failed`, `timeout`, `locked`, `unreadable`, `failed`. The details, with hosts and users, stay in the container's log. The `backup` service has a health check of its own (`backup-db.sh check`), which fails when the last night failed or the newest copy is older than 26 h.

### Patterns Applied

In the order of §3.5:

1. **Timeouts:** 15 min on `pg_dump`, 5 min on its wait for a lock, 1 min on recording the run.
2. **Bounded retries:** 3 attempts, 10 min apart (`BACKUP_RETRY_DELAY_SECONDS`). A fixed delay is enough here: one job retries, so there is no crowd of clients to spread out with jitter.
3. **The way out:** after the last attempt the night is recorded as failed, the marker is written, and the loop waits for the next night; the copies of earlier nights stay.

Also:

- **A check of the result:** a copy is kept only if `pg_restore --list` can read it.
- **Narrow failure reasons** instead of one "failed", so the admin panel can say what went wrong without showing the log.
- **Logging and a health check**, so a failed night is seen in the app, in `docker compose ps` and in the next deploy job.

### Fail Fast or Fail Safe

Both, at different levels.

- **For the nightly job, fail safe.** No backup is worse than a late one, so a failed night is retried, and after the last attempt the job waits for the next night instead of ending the container.
- **For each copy, fail fast.** A copy that cannot be read is worse than no copy, because it looks fine until the day it is needed, so it is deleted at once.
- **The backup before a deploy still fails fast**, with no retries, and stops the deploy, as before.

### What the User Sees

- **Administrators in the app:** the admin overview shows "Резервне копіювання бази даних потребує уваги." with the time of the last good copy, and the new **Резервні копії** page lists the last 30 nights with date, status, attempts, duration, size and the reason in Ukrainian. Hosts, users and error messages never reach the API.
- **Server operators:** the `backup` container turns unhealthy, and the next deploy job shows a `::warning::`. For 26 h after a restart (`start_period` in `docker-compose.staging.yml`) a failed check leaves the container `starting`, not `unhealthy`, so the deploy also looks for the `nightly-failed` marker, which stays in the backups folder across a restart: a night that failed every attempt is still warned about, but a copy that is only older than 26 h, with no failed night, is not warned about until the start period ends.
- **Users:** nothing; the backup does not affect requests.

### Recovery

Automatic the next night: a good night removes the marker and the health check passes again. To make up a missed night by hand: `docker compose exec backup sh /backup-db.sh nightly` ([staging](../operations/staging.md#backups-and-restore)).

### Verification

- [`tests/unit/backup-db.test.ts`](../../tests/unit/backup-db.test.ts) runs the real script with fake Postgres tools, under `sh` and `dash`: a good night, three failed attempts with no `.partial` left, a success after a failure, an unreadable copy, a run that cannot be recorded, every reason code, the health check, and the pre-deploy backup failing at once.
- [`tests/unit/backups.service.test.ts`](../../tests/unit/backups.service.test.ts) and the e2e tests of `GET /admin/backups` in [`tests/e2e/api.e2e.test.ts`](../../tests/e2e/api.e2e.test.ts).

### Open Issues

- **`pg_restore --list` reads the archive's table of contents, not the data.** A real restore is still the NFR REL-004 restore drill.

## REL-07: Profile Edit Hides the "More" Button When Interests Fail to Load

**Fault:** `useInterests` loaded once and had no retry, and profile edit never read its error, so "+ ще" was disabled with no message. Profile setup showed a message but had no retry. **Failure:** the user could not open the full list of interests and could not tell why; a new user could not reach the minimum of 3 interests.

### Before

```ts
// app/src/hooks/use-interests.ts: one load when the screen mounts; an error message, but no way to load again
export function useInterests() {
  useEffect(() => {
    // ... loads once, sets data or error
  }, []);

  return { data, loading, error };
}
```

```tsx
// app/src/app/profile-edit.tsx: `interests.error` is never read
onMore={interests.data ? () => setSheetOpen(true) : undefined}
```

### After

```ts
// app/src/hooks/use-interests.ts
export function useInterests() {
  const { data, failure, loading, reload } = useApiQuery('interests', loadInterests);
  return { data, loading, failed: !!failure, reload };
}
```

```tsx
// app/src/app/profile-edit.tsx, and the same in app/src/app/profile-setup.tsx
onMore={interests.data ? () => setSheetOpen(true) : undefined}
onRetry={interests.failed ? interests.reload : undefined}
```

With `onRetry` set, the interest picker in `app/src/components/profile/profile-form.tsx` shows a coral **Повторити** chip with the error mark in place of "+ ще".

### Patterns Applied

- **An explicit error state that the screens use** (`failed`, with `reload`): before, `useInterests` returned an `error` that profile edit never read.
- **A retry the user starts**, through the `reload()` of `useApiQuery`, as the catalog already does.

### Fail Fast or Fail Safe

The chosen reaction is to **fail safe**.

- **No answer is worse than a partial one here:** the interests are one optional field of a longer form, so blocking the form would lose the user's other changes.
- The finding was a **wrong answer** in disguise: a failed request looked like a list with nothing more to show. The fix keeps the safe part (profile edit still offers the user's saved interests, and the rest of the form saves) and makes the missing part visible.

### What the User Sees

A coral "Повторити" chip in place of "+ ще", read by screen readers as "Не вдалося завантажити інтереси. Повторити". "+ ще" is dimmed while the list loads and works normally once it arrives.

### Recovery

By the user, with one tap. No server action is needed.

### Verification

- [`app/tests/use-interests.test.tsx`](../../app/tests/use-interests.test.tsx) and [`app/tests/interest-picker.test.tsx`](../../app/tests/interest-picker.test.tsx) (`npm test` in `app/`): the list loads, "+ ще" is dimmed while loading, and it becomes "Повторити" after a failed load.
- By hand in the web app, with `/api/v1/interests` blocked in DevTools.

### Open Issues

- **The retry is manual.** There is no automatic retry; for one optional list a tap is enough.

## REL-08: A Lost Refresh Response Ends the Session

**Fault:** `SessionsService.refresh` replaced the refresh token before it answered, and any reuse of the old one ended the session as a theft. **Failure:** if the answer was lost to a timeout or a dropped connection, the app still held the old token, the next refresh used it, and the user was signed out.

### Before

```ts
// src/core/identity/services/sessions.service.ts
if (!sameHash(session.tokenHash, hashSecret(secret)) || account?.status !== 'active') {
  await this.sessionsRepository.revoke(session.id, now);
  throw invalidRefreshToken();
}
```

```ts
// app/src/api/session.ts: one try
renewal ??= publicClient
  .POST('/api/v1/auth/refresh', { body: { refreshToken } })
```

### After

```ts
// src/core/identity/services/sessions.service.ts
const presented = hashSecret(secret);
const current = sameHash(session.tokenHash, presented);
const retryOf = current ? undefined : rotationRetried(session, presented, now); // the previous token, within 60 s
if ((!current && !retryOf) || account?.status !== 'active') {
  await this.sessionsRepository.revoke(session.id, now);
  throw invalidRefreshToken();
}
// ...
if (!rotated) {
  throw new DomainError('CONFLICT', 'Another renewal of this session is in progress. Try again');
}
```

```ts
// app/src/api/session.ts
// At most three tries: once more after no answer, and once more at once after 409.
async function postRefresh(refreshToken: string) {
  // ...
  for (;;) {
    try {
      const result = await send();
      if (result.response.status !== 409 || retriedConflict) return result;
      retriedConflict = true;
    } catch (error) {
      if (retriedNoAnswer) throw error;
      retriedNoAnswer = true;
      await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS)); // 2 s
    }
  }
}
```

The session keeps the hash of the token it replaced and the time of the rotation (`previousTokenHash`, `rotatedAt`). The 60 s window follows [Okta](https://developer.okta.com/docs/guides/refresh-tokens/main/) (30 s by default, at most 60 s), [Auth0](https://support.auth0.com/center/s/article/Failed-token-exchange-when-reusing-an-older-refresh-token-within-leeway-period) (only the most recently replaced token) and a [proposal on the OAuth working group's list](https://mailarchive.ietf.org/arch/msg/oauth/X2S1otBruLSligdwp6vPs_WyZzo/) for the Security BCP (at most 60 s).

### Patterns Applied

In the order of §3.5:

1. **Timeout:** the app's 15 s request timeout from REL-02 on each try.
2. **Bounded retries:** once more 2 s after no answer, once more at once after `409`. A refresh is a write, and §3.5 allows retrying a write only when it is idempotent; the server makes it so.
3. **Idempotent retry on the server:** within 60 s, the token just replaced is accepted as a repeat of the lost request, not as a theft.
4. **The way out:** `409 CONFLICT` instead of ending the session when two refreshes collide; after the last try, the usual "no connection" error, with the token kept for the next request.

### Fail Fast or Fail Safe

**Fail safe for the user, fail fast for theft.**

- For the user, **no answer is worse than a repeated one**: being signed out over a dropped packet loses the session for nothing, so a retry within 60 s is accepted.
- For a stolen token, a **wrong answer is worse**: handing new tokens to an attacker. So the previous token after 60 s, an older token, a wrong secret or a banned account still end the session (NFR SEC-005). The accepted risk is TM-17 in the threat model, with device-bound tokens (DPoP) as the further step.

### What the User Sees

Nothing; they stay signed in. If even the retries get no answer, the usual "no connection" message appears and the next request tries again.

### Recovery

Automatic.

### Verification

- [`tests/unit/sessions.service.test.ts`](../../tests/unit/sessions.service.test.ts): the window's edges, a token two rotations old, a ban within the window, and the `409` race.
- [`tests/e2e/api.e2e.test.ts`](../../tests/e2e/api.e2e.test.ts): a lost answer and its retry, reuse after 61 s, and 5 parallel refreshes keeping the session.
- [`app/tests/session.test.ts`](../../app/tests/session.test.ts): one more try after no answer, the token kept when neither try is answered, no retry of an answered refresh, and the `409` retry.

### Open Issues

- **Mitigated, not fixed:** an outage longer than about 32 s (15 s, the 2 s wait, 15 s) still signs the user out, because the next refresh comes after the window.
- **Two browser tabs** keep separate copies of one refresh token, so one can still end the other's session; this was already the case before.

## REL-09: A Google Key Fetch Failure Answers 500

**Fault:** `JoseGoogleIdTokens` rethrew the errors of a failed key fetch (`ERR_JWKS_TIMEOUT` among them), but `app.module.ts` gave the exception filter only the database timeout check, and a Google that could not be reached at all came through as fetch's own `TypeError`. **Failure:** a Google sign-in while Google's keys could not be fetched answered `500 INTERNAL_ERROR`, a bug of the API to the app, instead of a `503` it can retry.

### Before

```ts
// src/infra/auth/jose-google-id-tokens.ts
const KEY_FETCH_ERRORS = new Set(['ERR_JOSE_GENERIC', 'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID']);
// ...
if (error instanceof errors.JOSEError && !KEY_FETCH_ERRORS.has(error.code)) {
  return undefined;
}
throw error;
```

```ts
// src/api/app.module.ts: only database timeouts count as unavailability
useFactory: (adapterHost: HttpAdapterHost) => new ApiExceptionFilter(adapterHost, isDatabaseTimeout),
```

### After

```ts
// src/infra/auth/jose-google-id-tokens.ts
export function isGoogleKeyFetchFailure(error: unknown): boolean {
  return error instanceof errors.JOSEError && KEY_FETCH_ERRORS.has(error.code);
}

// jose passes on fetch's own error when Google cannot be reached at all (refused, DNS): a key fetch failure too.
private async key(...args: Parameters<JWTVerifyGetKey>): Promise<Awaited<ReturnType<JWTVerifyGetKey>>> {
  try {
    return await this.keys(...args);
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      throw error;
    }
    throw new errors.JOSEError("Google's keys could not be fetched", { cause: error });
  }
}
```

```ts
// src/api/app.module.ts
useFactory: (adapterHost: HttpAdapterHost) =>
  new ApiExceptionFilter(
    adapterHost,
    (exception) => isDatabaseTimeout(exception) || isGoogleKeyFetchFailure(exception),
  ),
```

```ts
// src/api/common/api-exception.filter.ts, in unavailable(): true of both causes now
this.logger.error(`A dependency is unavailable: ${error.message}`, error.stack);
```

### Patterns Applied

- **Narrow error mapping**, as for REL-01: only the codes of `KEY_FETCH_ERRORS` count, and the set stays in the one file that knows jose. A bad signature, a wrong audience, an expired token or a key Google did not publish are still a rejected token, and any other error stays a logged `500`. `api` imports no jose; `core` is unchanged.
- **One error body for unavailability.** The filter already built the `503` of a database timeout; it now gets a check that also accepts a key fetch failure, so the app sees the same answer for both.
- **Logging.** The cause goes to the log as an error with its stack (`A dependency is unavailable: request timed out`), never to the body.

### Fail Fast or Fail Safe

The chosen reaction is to **fail fast**, as before; only the answer is now the right one.

- A **safe failure** would sign the user in without a checked token, a wrong answer worse than none: it hands an account to whoever sent the token.
- **Retries** are left to the client. jose already waits up to 5 s for the key set, and a sign-in is a request the user started, so a `503` the app can offer to repeat is better than holding it longer.

### What the User Sees

Before: `500 INTERNAL_ERROR` ("Something went wrong") while Google's keys could not be fetched.

After, within jose's 5 s limit for the key set:

```http
HTTP/1.1 503 Service Unavailable

{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "The service is temporarily unavailable. Try again later" } }
```

A bad Google token still answers `422 INVALID_GOOGLE_TOKEN` on registration and `401 INVALID_CREDENTIALS` on sign-in.

### Recovery

Automatic. jose keeps no failed key set, so the next sign-in fetches the keys again and succeeds as soon as Google answers.

### Verification

- [`tests/reliability/google-keys.reliability.test.ts`](../../tests/reliability/google-keys.reliability.test.ts) (fault injection) starts the built API with `GOOGLE_JWKS_URL` on a local fake key server: one that never answers (`503` within jose's limit, cause logged), one that answers `500`, and one that is not there at all, all `503`; a token that is not a JWT keeps `INVALID_GOOGLE_TOKEN` and `INVALID_CREDENTIALS`. With the `app.module.ts` of before the fix, the three `503` tests fail.
- [`tests/unit/jose-google-id-tokens.test.ts`](../../tests/unit/jose-google-id-tokens.test.ts): `isGoogleKeyFetchFailure` for each code of the set, and not for a bad signature, a wrong audience, an unknown key or a plain `Error`; an unreachable Google gives a key fetch error with fetch's error as its cause.
- [`tests/unit/api-exception.filter.test.ts`](../../tests/unit/api-exception.filter.test.ts): a key fetch failure gets the body of a database timeout, and a rejected Google token keeps its own.

### Open Issues

- **No `Retry-After` header** on the `503`, as for REL-01.
- **`ERR_JOSE_GENERIC` is jose's generic code.** In the API only the remote key set throws it to the filter (the access token check catches every jose error), so it means a key fetch failure here; a new jose call that rethrows it would answer `503` too.

## REL-10: The Rollback Runs Old Code on a Migrated Database

**Fault:** the rollback in `deploy-staging.sh` restored the previous checkout and image only; the migrations `migrate` had applied stayed. **Failure:** the previous API version ran on a newer schema, while `deploy.log` said only "rolled back".

### Before

```bash
# deploy/deploy-staging.sh
if [[ -n "$previous" && "$previous" != "$version" ]]; then
  git checkout --quiet --detach "$previous"
  restore=''
  export API_VERSION=$previous
  if start; then
    echo "$(date -u +%FT%TZ) $previous (rolled back from $version)" >>deploy.log
    echo "Rolled back to $previous" >&2
```

### After

```bash
# deploy/deploy-staging.sh
# The migrations in the database that commit $1 does not have, one per line: its code runs on a newer schema.
migrations_unknown_to() {
  # ...
  comm -23 <(printf '%s\n' "$applied" | grep . | sort) <(git ls-tree --name-only "$1:prisma/migrations" | sort)
}
```

```bash
# deploy/deploy-staging.sh, in the rollback
# Migrations cannot be undone, so the earlier code runs on them: better than no API, but the job says so.
kept=$(migrations_unknown_to "$previous") || kept='(the database could not be read)'
# ...
if start; then
  if [[ -n "$kept" ]]; then
    echo "$(date -u +%FT%TZ) $previous (rolled back from $version; the database keeps $kept)" >>deploy.log
    echo "::error::Rolled back to $previous, but the database keeps the migrations $kept, which $previous" \
      "does not know: \"A version runs on a newer schema\" in docs/operations/staging.md"
```

A deploy of an earlier commit by hand, which also runs old code on a newer schema, now gets a `::warning::` with the same check.

### Patterns Applied

- **Honest reporting** instead of a silent "rolled back".
- **A check of the schema against each version's migrations**, from `_prisma_migrations` and the commit's `prisma/migrations`.
- **A runbook** for the case: "A version runs on a newer schema" in [staging](../operations/staging.md#a-version-runs-on-a-newer-schema).

### Fail Fast or Fail Safe

The chosen reaction is to **fail safe**, but no longer silently.

- Here **no answer is worse**: without the rollback no API answers at all.
- How the previous version behaves on the newer schema depends on the migrations, so the job names them. They were checked for the case at hand on 2026-11-08: the 7 migrations `main` has and `staging` (`e56f92b`) does not, read against the code of `staging`.
  - **Reads keep working.** Prisma selects only the columns its client knows, and the old code does not read the new columns (`events.image_url`, `events.source_url`, `categories.slug`, `refresh_tokens.previous_token_hash`, `refresh_tokens.rotated_at`) or the new `backup_runs` table and `pgboss` schema.
  - **One write fails.** Creating a category: `categories.slug` is `NOT NULL` with no default, and the old code does not set it, so the insert is refused and the API answers `500`.
  - **The old import imports nothing.** It looks categories up by their English names, which a migration renamed into Ukrainian, so every record is skipped as `Unknown category` and reported as skipped.
  - **No write was found that stores wrong data.** The other new columns allow `NULL`, so rows the old code writes leave them empty, and its session rotation leaves the new `refresh_tokens` columns as they were.
  This holds for these migrations only; any later rollback needs the same check of the migrations the `::error::` names.
- Undoing the migrations is not an option: Prisma does not generate down migrations, and [its guide](https://www.prisma.io/docs/orm/prisma-migrate/workflows/generating-down-migrations) applies a hand-written one only after a failed migration; a migration that succeeded is reverted by a new migration.
- What was a wrong answer, "rolled back" with nothing more, is now an error that names the migrations, so an operator knows the rollback is only partial.

### What the User Sees

- **Users:** the previous version keeps answering. It can fail where the schema changed.
- **Operators:** a red deploy job with an `::error::` naming the migrations, and the same in `deploy.log`.

### Recovery

Manual, following "A version runs on a newer schema" in [staging](../operations/staging.md#a-version-runs-on-a-newer-schema): check the API log, then either deploy a fix, or restore the copy taken just before the failed deploy.

### Verification

- [`tests/unit/deploy-staging.test.ts`](../../tests/unit/deploy-staging.test.ts) runs `migrations_unknown_to` from the real script in a temporary git repository with a fake `docker`: the migrations the commit lacks, none, and a database that cannot be read.
- By hand against a local database.

### Open Issues

- **Mitigated, not fixed:** the old code can still fail on the newer schema. Closing it needs migrations the previous version can run on (expand first, remove in a later release), which is a rule for writing migrations, not a change to the script.

## REL-12: Any Refresh Error Other Than 401 Reads as "No Connection"

**Fault:** `renew` threw a plain `Error` for every answer other than 200 and 401, and `call()` turns any thrown error into status `0`. **Failure:** when the refresh endpoint answered, for example with `503`, the request that needed the renewal was never sent and the screens said "Could not reach the server." or "Немає зʼєднання", although the API had answered.

### Before

```ts
// app/src/api/session.ts, in renew()
} else if (response.status === 401) {
  await endSession();
} else {
  throw new Error('Could not renew the session');
}
```

```ts
// app/src/api/public-client.ts, in call()
} catch {
  return { ok: false, status: 0 };
}
```

### After

```ts
// app/src/api/refresh-failed-error.ts
export class RefreshFailedError extends Error {
  readonly status: number;
  readonly code?: string;
  // ...
}
```

```ts
// app/src/api/session.ts, in renew()
} else {
  throw new RefreshFailedError(
    response.status,
    (error as { error?: { code?: string } } | undefined)?.error?.code,
  );
}
```

```ts
// app/src/api/public-client.ts
} catch (error) {
  return error instanceof RefreshFailedError ? refreshFailure(error) : { ok: false, status: 0 };
}

// The API answered the renewal, so this is not "no connection" (REL-12). Only 429 and 5xx keep their status: screens
// read a 409 or 400 as a conflict or bad input of their own request, so any other answer is reported as 503.
function refreshFailure({ status, code }: RefreshFailedError): Extract<ApiResult<never>, { ok: false }> {
  return status === 429 || status >= 500 ? { ok: false, status, code } : { ok: false, status: 503 };
}
```

The class has a file of its own because `public-client.ts` cannot import from `session.ts`, which imports it.

### Patterns Applied

- **Keep the cause.** The error carries the status and code the API sent, and status `0` is left for a request that got no answer.
- **No new message for a screen to misread.** `5xx` and `429` reach the screens as they are. A `409` after its retry (REL-08) or a `400` is reported as `503`: the screens give those statuses a meaning of their own request ("Ця пропозиція вже не діє", "Категорія з такою назвою вже є"), and no screen branches on `503`.
- **Unchanged around it:** the retries of `postRefresh` (REL-08), the single renewal (`renewal ??=`), and the end of the session on `401`.

### Fail Fast or Fail Safe

The chosen reaction is to **fail fast** with the true cause.

- The session itself **fails safe**: only `401` ends it. A `5xx`, a `429` or a `409` keeps the refresh token, so the next request renews again; signing the user out over a busy server would lose the session for nothing.
- For the message, a **wrong answer is worse** than a vague one: "check the internet" sends the user to look for a fault they do not have. A generic "Щось пішло не так" is less precise than a `409` of the refresh would be, but never points at the wrong cause.

### What the User Sees

Before: "Could not reach the server." (the hooks of `use-categories.ts`, `use-events.ts` and `use-event.ts`) or "Немає зʼєднання / Перевір інтернет" (`failureSnackbar`), while the API answered.

After: the screen's own message for a failure with an answer, e.g. "Could not load categories." or "Щось пішло не так / Спробуй ще раз за хвилину". With no answer at all, the "no connection" messages stay as before.

### Recovery

Automatic. The user stays signed in with the same refresh token, and the next request renews the session.

### Verification

- [`app/tests/client.test.ts`](../../app/tests/client.test.ts) runs the real `apiClient` and `call()` with the refresh request stubbed: a refresh answered `503`, `500` or `429` gives that status and code, the request is not sent and the user stays signed in; `409` after its retry gives `503`; the next request after a `503` renews and is sent with the new token; `401` signs out; no answer on either try gives `0`; a `200` renewal sends the request with the new token. On the code before the fix, the four status tests fail.
- [`app/tests/session.test.ts`](../../app/tests/session.test.ts): a refresh answered `503` rejects with that status and code, still without a second try.

### Open Issues

- **A timeout still reads as "no connection"**; see the Open Issues of [REL-02](#rel-02-app-requests-without-a-timeout).
- **The status of a `409` or `400` refresh is not shown.** It is reported as `503`, so a screen cannot tell it from a busy server.

## REL-14: Karabas Pages Without Usable JSON-LD Give a Succeeded Run

**Fault:** `jsonLdObjects` gives an empty list for a page without JSON-LD and for one whose blocks do not parse, and `fetch` counted a section as failed only when the request threw or answered other than 200. **Failure:** if Karabas changed its markup, every section page answered 200 with no events, the run was recorded as `succeeded` with 0 events and the import exited with 0. New and changed Karabas events stopped arriving without any warning; the same happened unnoticed for a single section.

### Before

```ts
// src/infra/providers/karabas-event-provider.ts, in readSection(): only an HTTP failure counts
const response = await this.http.get(url);
if (response.status !== 200) {
  throw new Error(`answered ${response.status}`);
}
html = response.text;
// ...
const events = jsonLdObjects(html).filter(isEvent);
```

### After

```ts
// src/infra/providers/karabas-event-provider.ts, in readSection()
html = response.text;
jsonLd = readJsonLd(html);
// Every saved section page has the site's Organization, CollectionPage and BreadcrumbList blocks besides its
// events, and a section without events keeps them. A page where no block parses is a changed or broken page,
// not an empty section, so it counts like a page that did not answer (REL-14).
if (jsonLd.objects.length === 0) {
  throw new Error(`answered 200 without JSON-LD that parses (${jsonLd.blocks} blocks)`);
}
// ... in the catch, as before:
this.logger.warn(`GET ${url} failed: ${errorMessage(error)}`);
return page === 1 ? 'failed' : 'incomplete';
```

```ts
// src/infra/providers/provider-pages.ts: jsonLdObjects, which ArtWizard uses, gives the same as before
export function jsonLdObjects(html: string): Record<string, unknown>[] {
  return readJsonLd(html).objects;
}
```

A page that is read but has some blocks that do not parse is warned about too (`GET … : 1 of 5 JSON-LD blocks are not JSON; skipped`).

### Patterns Applied

- **A check of the answer, not only of the status.** A `200` counts as read only when the page has JSON-LD that parses. The rule follows the saved pages: all nine carry four site blocks besides their events, and the sport pages list only one or two events, so a page with no events still has JSON-LD. The test fixture of an empty section is a saved page with its event blocks removed and its `ItemList` emptied, which is what such a page is expected to look like.
- **The existing failure path.** A page without JSON-LD goes the same way as a page that answered `503`: a warning with the URL (never the page), `failed` on a section's first page, `incomplete` on a later one, and `No Karabas section page could be fetched` when every section failed.
- **No change for the other caller.** `readJsonLd` is a separate function with the counts; `jsonLdObjects` keeps its return type and result for ArtWizard.

### Fail Fast or Fail Safe

The chosen reaction is to **fail fast** for the run and **fail safe** for the catalog.

- For the run, a **wrong answer is worse**: "succeeded, 0 events" hid the change. Now a section without usable JSON-LD is a failure that is logged and counted, and a run where every section is so fails (`importFrom()` records it `failed`, the import exits non-zero).
- For the catalog, **no answer is worse** than an old one: a failed or incomplete section makes the list incomplete, so nothing is cancelled, and a failed run keeps the events of the last good run (NFR REL-003, FR-014).

### What the User Sees

- **Users:** nothing new. The Karabas events of the last good run stay in the catalog.
- **Operators:** before, a succeeded run with 0 events. After, a warning per section page without usable JSON-LD, the count of failed sections in the run's summary line, and a failed run when no section could be read.

### Recovery

Manual: the provider has to be fitted to the new markup. The next run after that imports again, and as soon as a section page has its JSON-LD back, it is read as before.

### Verification

[`tests/unit/karabas-event-provider.test.ts`](../../tests/unit/karabas-event-provider.test.ts), with three pages derived from the saved sport page of 2026-11-07 in [`tests/unit/fixtures/providers/karabas/`](../../tests/unit/fixtures/providers/karabas/) (no JSON-LD, every block cut short, no events):

- every section without JSON-LD, or with only blocks that do not parse: `fetch` throws `No Karabas section page could be fetched`, with one warning per section naming its URL;
- one section without JSON-LD: the other sections are imported, the summary counts 1 failed section, and the list is not complete;
- a later page without usable JSON-LD: the first page's events are kept and the section is counted as not read to the end;
- a page with the site blocks and no events: a complete list of 0 events and no warning;
- a page with one block that does not parse: read, with a warning.

On the provider before the fix, the five tests that expect a failure or a warning fail. The ArtWizard tests pass unchanged. The e2e import test now serves the unsaved Karabas sections the derived page without events, which keeps the site blocks.

### Open Issues

- **Mitigated, not fixed:** a page that keeps its JSON-LD but no longer gives events, e.g. renamed `@type`s or fields moved, is still read as a section with no events; each event that loses a field is skipped with its reason. A further step would compare the events found with the `numberOfItems` of the page's `CollectionPage` and warn when they differ.
- **A succeeded run with 0 events is still possible** when every section really has none in the window, and is not told apart from the case above.
- **Partly failed runs are not escalated.** A failed section is a warning and an incomplete list; nobody is alerted until every section fails.

## Reliability Tests

The tests in [`tests/reliability/`](../../tests/reliability/) start the built API, or the app's request code, against fake dependencies, so none needs a database. They run with `npm run test:reliability` and as the CI job `Reliability tests` ([bonus 3](#reliability-tests-as-a-required-check)). When this report was last updated (#511): 35 tests in 7 files, all passing.

| File | Type | Finding | What it proves |
|---|---|---|---|
| [`error-handling.reliability.test.ts`](../../tests/reliability/error-handling.reliability.test.ts) | Error handling | REL-01 | With a database that refuses the connection, the categories handler throws an error that is not a timeout. The API answers `500` with only the generic `INTERNAL_ERROR` body (no database address, Prisma message or stack), logs the cause, and keeps answering the next requests. |
| [`database-timeouts.reliability.test.ts`](../../tests/reliability/database-timeouts.reliability.test.ts) | Fault injection | REL-01 | A fake Postgres that does not answer the startup or a query, or cancels the statement with `57014`: the API answers `503` within its limits, logs the cause, and gives its pool connections back. |
| [`request-timeout.reliability.test.ts`](../../tests/reliability/request-timeout.reliability.test.ts) | Fault injection | REL-02 | The app's `fetchWithTimeout` against a fake API: no answer and a body that stops in the middle are aborted after 15 s and not before; a dropped connection fails at once. |
| [`google-keys.reliability.test.ts`](../../tests/reliability/google-keys.reliability.test.ts) | Fault injection | REL-09 | A fake Google key server that never answers, answers `500` or is not there: a Google sign-in answers `503 SERVICE_UNAVAILABLE` and logs the cause; a token that is not a JWT keeps its own error. |
| [`health-check.reliability.test.ts`](../../tests/reliability/health-check.reliability.test.ts) | Fault injection | REL-04 | A database that refuses the connection or never answers: `/health` answers `503 unhealthy` within its limit, and the Dockerfile's `HEALTHCHECK` command fails. |
| [`database-timeout-settings.reliability.test.ts`](../../tests/reliability/database-timeout-settings.reliability.test.ts) | Boundary | REL-01 | The API starts with `DATABASE_STATEMENT_TIMEOUT_MS` empty or exactly one day, and stops with exit code 1 and a message naming the variable on `0`, `-1`, `abc`, one day and 1 ms, and `99999999999999999999`. This test found that a value too long for Node's timers started an API whose every database call failed; #405 fixed it. |
| [`port-and-rate-limit-settings.reliability.test.ts`](../../tests/reliability/port-and-rate-limit-settings.reliability.test.ts) | Boundary | REL-05 | The API stops with exit code 1 and a message naming the variable on `PORT` `0`, `-1`, `abc`, `70000` and `1.5`, and on `AUTH_RATE_LIMIT_PER_MINUTE` `0`, `-5`, `abc` and `1.5`. With an empty limit the first sign-in request is not refused, and a limit of `1` starts the API. |

[`api-process.ts`](../../tests/reliability/api-process.ts) is not a test: it starts and stops the built API for the others and checks that a start is refused.

All three types the lab asks for are there. The tests were also run against broken code, and fail there:

- `database-timeouts`: with the pool of before the fix, the two tests that wait for an answer hang until their 12 s guard; the other two check the error mapping and the pool and pass with it;
- `health-check`: all four fail on the code before the REL-04 fix;
- `error-handling`: both fail when the filter puts the error's message in the body;
- `google-keys`: the three `503` tests fail with the `app.module.ts` before the REL-09 fix;
- `request-timeout`: the no-answer test fails with a 10 s limit, and the stalled-body test when the timer is cleared once the headers arrive; the dropped-connection test was not checked this way;
- `database-timeout-settings`: the two values above one day fail without the one-day check;
- `port-and-rate-limit-settings`: on the `config.ts` before the fix, 10 of 11 fail; the limit of `1` starts the API either way.

The fixes of REL-06, REL-07, REL-08, REL-10, REL-12 and REL-14 are covered by unit, e2e and app tests, listed in their sections.

## Open Findings

- **REL-11** (Low): no user request is affected. Proposed: guard `finishRun` in the `catch` of `importFrom()`, log its error and rethrow the original one.
- **What is left of REL-08, REL-10 and REL-14** is in their Open Issues: [REL-08](#rel-08-a-lost-refresh-response-ends-the-session), [REL-10](#rel-10-the-rollback-runs-old-code-on-a-migrated-database) and [REL-14](#rel-14-karabas-pages-without-usable-json-ld-give-a-succeeded-run).

## Bonuses

### Retries With Backoff and Jitter

The import's GET requests to ArtWizard, Karabas and Nominatim go through [`PoliteHttpClient`](../../src/infra/providers/http-client.ts). They are idempotent reads, run in the background, and the import runs once and exits, so this client is the only level that retries. In the order of §3.5:

1. **Timeout** on each attempt: 20 s (`AbortSignal.timeout`).
2. **Bounded retries** over it: at most 4 attempts, only after a network error, a timeout, `429` or `5xx`; a `404` is returned at once. Before each retry the client waits a random time between 0 and `backoffMs · 2^attempt` (1, 2, then 4 s), never above `maxBackoffMs` (8 s): full jitter.
3. **The way out** after the last attempt: the failure is logged as an error (`GET … failed after 4 attempts (…); giving up`) and passed on, so that provider's run fails, and the catalog keeps the events of the last good run (NFR REL-003, TC-28).

```ts
// src/infra/providers/http-client.ts, in getWithRetries()
const wait = Math.round(Math.random() * Math.min(maxBackoffMs, backoffMs * 2 ** attempt));
this.logger.warn(`GET ${redactedUrl(url)} failed (${failure}); retrying in ${wait} ms`);
await sleep(wait);
```

- **Test:** [`tests/unit/polite-http-client.test.ts`](../../tests/unit/polite-http-client.test.ts): a server that keeps answering `503` gets exactly the allowed attempts and the failure is logged; an unreachable server makes the call throw after its attempts and log it; with `Math.random` fixed at 0.5 the waits are 2, 4 and 5 ms, the last cut to the 10 ms cap.
- **PR:** #400 (issue #389).

### Health Check (REL-04)

`GET /health` checks the database with `SELECT 1` and answers `503 unhealthy` when it fails or does not answer within 2 s, so the deploy's rollback reacts to a dead database; a fault-injection test shows "unhealthy" with a database that refuses the connection and with one that never answers. Details in [REL-04](#rel-04-health-does-not-check-the-database); code in [`health.service.ts`](../../src/core/system/services/health.service.ts) and [`prisma-database-probe.ts`](../../src/infra/prisma/prisma-database-probe.ts), test in [`health-check.reliability.test.ts`](../../tests/reliability/health-check.reliability.test.ts), PR #399.

### Reliability Tests as a Required Check

The `Reliability tests` job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `npm run test:reliability` on every pull request and every push to `main` and `staging`, as a job of its own next to `CI passed`. The `main` ruleset lists `Reliability tests` among its required status checks, with `CI passed` and `SonarCloud Code Analysis`, so a pull request cannot be merged while it fails.

- **Passing runs:** on `main`, [run 42476676384](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/runs/42476676384/job/128719478167); on a pull request, [#411](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/runs/42475237652/job/128714980762).
- **PRs:** #406 (the job, issue #390) and #411 (an assertion SonarCloud asked for in the boundary test).

## AI Usage Note

Drafted with Claude Code from the team's findings, fixes and pull requests. Every code snippet and claim was checked against the code, and the reliability tests were run against the code before the fixes where stated. Reviewed by Daryna Halytska.
