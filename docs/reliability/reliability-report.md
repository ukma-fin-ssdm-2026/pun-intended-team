# Reliability Report

Fixes of the risks found in the [reliability scavenger hunt](scavenger-hunt.md), Lab 9.

## Findings

Severity rates the consequence if the failure happens, not how likely it is.

| ID | Finding | Severity | Reason | Status |
|---|---|---|---|---|
| [REL-01](scavenger-hunt.md#rel-01-database-calls-without-timeouts) | Database calls have no connection or statement timeout | High | One stuck query could exhaust the pool and stop the whole API, sign-in included. | Fixed |
| [REL-02](scavenger-hunt.md#rel-02-app-requests-without-a-timeout) | App requests have no timeout | Medium | A request could leave a screen loading forever on Android, but only that screen is affected. | Fixed |
| [REL-03](scavenger-hunt.md#rel-03-sign-out-dispatches-an-unhandled-navigation-action) | Sign-out dispatches a navigation action no navigator handles | Low | Only the navigation after sign-out is affected, and the user can navigate on their own. | Open |
| [REL-04](scavenger-hunt.md#rel-04-health-does-not-check-the-database) | `/health` answers "ok" without checking the database | High | A dead database goes unnoticed by the deploy rollback, the compose health gate and the uptime monitor, while every request that needs it fails. | Open |
| [REL-05](scavenger-hunt.md#rel-05-port-and-auth_rate_limit_per_minute-are-not-checked) | `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are not checked | High | The API becomes unreachable or refuses every sign-in. | Open |
| [REL-06](scavenger-hunt.md#rel-06-a-failed-nightly-backup-skips-the-day) | A failed nightly backup skips the day without notice | Medium | Data is not lost at once, but the day has no backup and nobody is told. | Open |
| [REL-07](scavenger-hunt.md#rel-07-profile-edit-hides-the-more-button-when-interests-fail-to-load) | Profile edit hides the "more" button when interests fail to load | Low | One optional list is missing and the rest of the screen works. | Open |
| [REL-08](scavenger-hunt.md#rel-08-a-lost-refresh-response-ends-the-session) | A lost refresh response ends the session | Medium | The user is signed out of the account and has to sign in again. | Open |
| [REL-09](scavenger-hunt.md#rel-09-a-google-key-fetch-failure-answers-500) | A Google key fetch failure answers 500 instead of 503 | Low | Sign-in fails either way; only the status the app could retry on is wrong. | Open |
| [REL-10](scavenger-hunt.md#rel-10-the-rollback-runs-old-code-on-a-migrated-database) | The automatic rollback runs the old image on migrated data | High | The API can run against a schema it does not match while the deploy reports a successful rollback. | Open |
| [REL-11](scavenger-hunt.md#rel-11-run-loses-the-cause-when-finishrun-throws) | `run()` loses the cause when `finishRun` throws | Low | The cause of a failed import is lost and the run stays marked `running`; no user is affected. | Open |
| [REL-12](scavenger-hunt.md#rel-12-any-refresh-error-other-than-401-reads-as-no-connection) | Any refresh error other than 401 reads as "no connection" | Low | The message is misleading, but the user's data and session are not harmed. | Open |
| [REL-13](scavenger-hunt.md#rel-13-the-genre-constructor-fails-the-whole-import) | The genre `constructor` fails the whole import | Medium | One bad record fails the whole import, so no further records of the feed are imported. | Open |

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

### Fail Fast, Not Safe Failure

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
- **No `Retry-After` header** on the `503`; the app decides on its own when to retry. The app's own requests still have no timeout (REL-02).

## AI Usage Note

The fix, its tests and this report were generated with Claude Code from the scavenger-hunt finding. Verified by running the unit and fault-injection tests, by checking that the fault-injection tests hang without the fix, and by checking the errors pg and Prisma throw against a fake Postgres. To be reviewed by the team.
