# Reliability Scavenger Hunt

Reliability risks found in the Nearby API (`src/`) and mobile app (`app/`) for Lab 9, with their fault → error → failure chain.

## Findings

A error handling, B external dependencies, C input validation, D silent failures, E performance and blocking. Severity is explained in the [reliability report](reliability-report.md#findings).

| ID | Finding | Category | Severity | Location |
|---|---|---|---|---|
| REL-01 | Database calls have no connection or statement timeout | B, E | High | `src/infra/prisma/prisma.service.ts` |
| REL-02 | App requests have no timeout; on Android they can wait forever | E, D | Medium | `app/src/api/client.ts`, `app/src/api/public-client.ts` |
| REL-03 | Sign-out dispatches a navigation action no navigator handles | D | Low | `app/src/app/(tabs)/profile.tsx`, `app/src/app/organization/settings.tsx` |
| REL-04 | `/health` answers "ok" without checking the database, so a deploy that cannot reach it is not rolled back | D, B | High | `src/api/system/controllers/system.controller.ts`, `src/infra/prisma/prisma.service.ts` |
| REL-05 | `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are read with `Number()` and not checked: an empty value blocks every sign-in or picks a random port | C, B | High | `src/api/common/config.ts` |
| REL-06 | A failed nightly backup skips the day without notice and leaves its `.partial` file on disk | D, B | Medium | `deploy/backup-db.sh` |
| REL-07 | When interests fail to load, profile edit hides the "more" button instead of showing an error | D | Low | `app/src/app/profile-edit.tsx` |
| REL-08 | A refresh response lost after the server rotated the token makes the app retry with the old one, and the server ends the session | B, D | Medium | `app/src/api/session.ts`, `src/core/identity/services/sessions.service.ts` |
| REL-09 | A failure to fetch Google's keys (`ERR_JWKS_TIMEOUT`) reaches `unexpected()` of the exception filter and answers 500 instead of 503 | A, B | Low | `src/infra/auth/jose-google-id-tokens.ts`, `src/api/app.module.ts` |
| REL-10 | The automatic rollback starts the previous image on a database whose migrations are already applied | B | High | `deploy/deploy-staging.sh` |
| REL-11 | If `finishRun` itself throws in `importFrom()`, the original error is lost and the run stays `running` | A | Low | `src/core/import/services/event-import.service.ts` |
| REL-12 | Any refresh answer other than 401 (for example 503) reaches the screens as "Could not reach the server." | D | Low | `app/src/api/session.ts` |
| REL-14 | A Karabas section page that answers 200 without usable JSON-LD gives no events and no warning, so a broken layout ends as a succeeded run with 0 events | D, B | Medium | `src/infra/providers/provider-pages.ts`, `src/infra/providers/karabas-event-provider.ts` |

## Details

For a finding that is already fixed, the code shows the version before the fix; the fix is in the [reliability report](reliability-report.md).

### REL-01: Database calls without timeouts

```ts
// src/infra/prisma/prisma.service.ts, before the fix in #367
super({ adapter: new PrismaPg({ connectionString }) });
```

**Why it is dangerous:** nothing bounds a database call, so a slow or silent database turns into requests that never end, with no error and no log line.
**Potential impact:** every endpoint that uses the database, sign-in included, shares the same pool of 10 connections, so one stuck table can stop the whole API.
**Fault:** the API's pg pool was created from a connection string alone, so pg's defaults applied: no connect, statement or query timeout.
**Error:** a call to a locked or silent database never ended, and the stuck calls held the pool's connections.
**Failure:** requests hung with no answer and, once the pool was exhausted, the whole API stopped answering, sign-in included.
**Severity:** High
**Status:** fixed in #367: every pool checkout, statement and lock wait has a time limit, and a timeout answers `503` ([report](reliability-report.md#rel-01-database-calls-without-timeouts)).

### REL-02: App requests without a timeout

```ts
// app/src/api/client.ts, before the fix in #367 (the same in public-client.ts)
export const apiClient = createClient<paths>({ baseUrl: config.apiUrl });
```

**Why it is dangerous:** the request has no upper bound on the client side, so the app depends on the network or the server to end it.
**Potential impact:** every screen that loads from the API, and the session renewal, which goes through `publicClient`.
**Fault:** the app's API clients called `fetch` with no timeout, and React Native on Android sets none of its own.
**Error:** a request to a server that does not answer never settled, so the screen's loading state never ended.
**Failure:** the user sees an endless spinner with no error and no way out.
**Severity:** Medium
**Status:** fixed in #367: both clients abort a request after 15 s ([report](reliability-report.md#rel-02-app-requests-without-a-timeout)).

### REL-03: Sign-out dispatches an unhandled navigation action

```tsx
// app/src/app/(tabs)/profile.tsx, before the fix in #367 (the same in organization/settings.tsx)
void signOut();
// Signing out starts a new history on the onboarding, so back cannot return to the account.
router.dismissAll();
router.replace('/onboarding');
```

**Why it is dangerous:** `dismissAll()` is called even when there is no screen to dismiss, and the dropped action gives the user no error.
**Potential impact:** the navigation after sign-out on two screens; the sign-out itself still happens.
**Fault:** the sign-out handlers of the profile and organization settings screens dispatch a navigation action that no navigator handles.
**Error:** the navigation action is dropped without a message.
**Failure:** the screen stays as it was after the user chose to sign out, or the history is not reset, with no error shown.
**Severity:** Low
**Status:** already fixed in #367: both handlers call `router.dismissAll()` only when `router.canDismiss()`, so no unhandled action is dispatched.

### REL-04: `/health` does not check the database

```ts
// src/api/system/controllers/system.controller.ts, before the fix in #399
getHealth(): HealthResponse {
  return { status: 'ok' };
}
```

```dockerfile
# Dockerfile, unchanged by the fix
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://localhost:${process.env.PORT ?? 4100}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
```

**Why it is dangerous:** the health check reports the process, not the service, so every check built on it says "healthy" while the API cannot serve data.
**Potential impact:** the deploy rollback, the compose start order and the uptime monitor all miss a dead database.
**Fault:** `getHealth` returns `{ status: 'ok' }` without touching the database, and `PrismaService` connects lazily, on the first query, so nothing fails at startup.
**Error:** an API with no working database connection, for example with a wrong `MAIN_DATABASE_URL`, starts and reports "ok".
**Failure:** three consumers trust `/health`: the `HEALTHCHECK` in the `Dockerfile`, whose result decides the rollback in `deploy-staging.sh`, so a deploy that cannot reach the database is not rolled back; the `service_healthy` condition on the API in `docker-compose.staging.yml`, which Caddy waits for; and the external uptime monitor of NFR REL-001, which counts 100% uptime while the database is dead. Users get errors on every request that needs the database.
**Severity:** High
**Status:** fixed in #399: `/health` runs `SELECT 1` with a 2 s limit and answers `503` `unhealthy` with `database: down` when it fails, so all three consumers see a dead database ([report](reliability-report.md#health-check-rel-04)).

### REL-05: `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are not checked

```ts
// src/api/common/config.ts, before the fix in #425
export const port = Number(process.env.PORT ?? DEFAULT_PORT);
export const authRateLimitPerMinute = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 20);
```

```ts
// src/api/app.module.ts
ThrottlerModule.forRoot([{ ttl: MINUTE_MS, limit: authRateLimitPerMinute }]),
```

**Why it is dangerous:** `??` only replaces an unset variable, not an empty one, and `Number('')` is `0`, so a typo in `.env` gives a value that looks valid and the server starts without a warning.
**Potential impact:** the whole API (wrong port), or the three endpoints guarded by `ThrottlerGuard` in `auth.controller.ts`: Google registration, Google sign-in and session refresh.
**Fault:** `config.ts` reads both with `Number(process.env.X ?? default)` and no validation, so an empty value becomes 0.
**Error:** the server gets port 0 (the system picks a random port), or the sign-in rate limit is 0 requests per minute.
**Failure:** nothing reaches the API on its expected port, or every request to a rate-limited sign-in endpoint is refused as too many requests.
**Severity:** High
**Status:** fixed in #425: an empty value takes the default, and anything but a whole number in range stops the start with a message naming the variable ([report](reliability-report.md#rel-05-port-and-auth_rate_limit_per_minute-are-not-checked)).

### REL-06: A failed nightly backup skips the day

```sh
# deploy/backup-db.sh, before the fix in #398
set -eu

dump() {
  mkdir -p "/backups/$1"
  file="/backups/$1/$PGDATABASE-$(date -u +%Y-%m-%dT%H%M%S).dump"
  pg_dump --format=custom --file="$file.partial"
  mv "$file.partial" "$file"
  echo "Backup written: $file"
}

while true; do
  next=$(date -u -d '01:00' +%s)
  if [ "$next" -le "$(date -u +%s)" ]; then
    next=$(date -u -d 'tomorrow 01:00' +%s)
  fi
```

**Why it is dangerous:** the only sign of a failed backup is the container's log and restart; nothing alerts anyone, and nothing tries again the same day.
**Potential impact:** the staging database can go a day or more without a backup, and a broken copy is found only during a restore.
**Fault:** the script runs under `set -e`, so a failed `pg_dump` ends the script, and nothing checks that a dump can be restored.
**Error:** the container restarts (`restart: unless-stopped` in `docker-compose.staging.yml`), the script takes the next 01:00 as tomorrow's in its `while true` loop, and the `.partial` file stays on disk.
**Failure:** no backup exists for that day and nobody is told; a copy that cannot be restored is discovered only when it is needed.
**Severity:** Medium
**Status:** fixed in #398: a failed night is retried, a copy is kept only if `pg_restore` can read it, and administrators and operators are warned ([report](reliability-report.md#rel-06-a-failed-nightly-backup-skips-the-day)).

### REL-07: Profile edit hides the "more" button when interests fail to load

```tsx
// app/src/app/profile-edit.tsx, before the fix in #398
const interests = useInterests();
// ...
onMore={interests.data ? () => setSheetOpen(true) : undefined}
```

**Why it is dangerous:** a failed request looks the same as a list with nothing more to show, so the error is silent.
**Potential impact:** the user can only pick from the interests already in their profile, and nothing tells them why.
**Fault:** `onMore` depends only on `interests.data`, and `interests.error` is never read.
**Error:** `useInterests` ends with an error and no data, and the screen treats that as "nothing to show".
**Failure:** the user cannot open the full list of interests and sees no error or retry.
**Severity:** Low
**Status:** fixed in #398: after a failed load, "+ ще" becomes "Повторити", which loads the list again ([report](reliability-report.md#rel-07-profile-edit-hides-the-more-button-when-interests-fail-to-load)).

### REL-08: A lost refresh response ends the session

```ts
// app/src/api/session.ts, before the fix in #398: the new refresh token is saved only when the response arrives
renewal ??= publicClient
  .POST('/api/v1/auth/refresh', { body: { refreshToken } })
  .then(async ({ data, response }) => {
    if (data) {
      await startSession(data);
```

```ts
// src/core/identity/services/sessions.service.ts, before the fix in #398: a reused token ends the session
if (!sameHash(session.tokenHash, hashSecret(secret)) || account?.status !== 'active') {
  await this.sessionsRepository.revoke(session.id, now);
  throw invalidRefreshToken();
}
```

**Why it is dangerous:** the server cannot tell an app that missed the response from an attacker replaying a stolen token, and the app's 15 s request timeout (`fetchWithTimeout`) can itself drop a slow response.
**Potential impact:** any signed-in user on a slow or unstable connection.
**Fault:** the app saves the rotated refresh token only when the response arrives (in `renew`), while the server rotates it before replying and revokes the session on any reuse of the old one (in `SessionsService.refresh`).
**Error:** the server holds the new token and the app still holds the old one after a response lost to a timeout or a dropped connection.
**Failure:** the next refresh sends the old token, the server treats it as stolen and ends the session, and the user is signed out of the account.
**Severity:** Medium
**Status:** mitigated in #398: the replaced token is accepted for 60 s, and the app retries a refresh that got no answer; an outage longer than about 32 s still ends the session ([report](reliability-report.md#rel-08-a-lost-refresh-response-ends-the-session)).

### REL-09: A Google key fetch failure answers 500

```ts
// src/infra/auth/jose-google-id-tokens.ts
const KEY_FETCH_ERRORS = new Set(['ERR_JOSE_GENERIC', 'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID']);
// ...
} catch (error) {
  if (error instanceof errors.JOSEError && !KEY_FETCH_ERRORS.has(error.code)) {
    return undefined;
  }
  throw error;
}
```

```ts
// src/api/app.module.ts: only database timeouts count as unavailability
useFactory: (adapterHost: HttpAdapterHost) => new ApiExceptionFilter(adapterHost, isDatabaseTimeout),
```

**Why it is dangerous:** an outage of an external dependency is reported as a bug of the API, so the client does not know it may try again.
**Potential impact:** Google sign-in while Google's keys cannot be fetched; the log shows an internal error instead of an unavailable dependency.
**Fault:** `JoseGoogleIdTokens` rethrows key-fetch errors (`ERR_JWKS_TIMEOUT` among them), but `app.module.ts` gives the exception filter only the database timeout check, so these errors are not recognised as unavailability.
**Error:** the filter takes the error for an unexpected one and logs it as an internal error.
**Failure:** the app gets `500 INTERNAL_ERROR` instead of a `503` it could retry when Google's keys cannot be fetched.
**Severity:** Low

### REL-10: The rollback runs old code on a migrated database

```bash
# deploy/deploy-staging.sh, before the fix in #398
echo "$version is not healthy: ${compose[*]} logs api migrate" >&2
if [[ -n "$previous" && "$previous" != "$version" ]]; then
  git checkout --quiet --detach "$previous"
  restore=''
  export API_VERSION=$previous
  if start; then
    echo "$(date -u +%FT%TZ) $previous (rolled back from $version)" >>deploy.log
```

**Why it is dangerous:** the rollback restores the code but not the schema, and its success is judged by `/health` (REL-04), which does not touch the database.
**Potential impact:** staging after any failed deploy that came with a migration.
**Fault:** the rollback in `deploy-staging.sh` restores the previous checkout and image only; the migrations applied by `migrate` are not reverted.
**Error:** the previous API version runs against a schema that is newer than it expects.
**Failure:** `deploy.log` and the job report "rolled back", while the API can fail on queries that the new schema changed.
**Severity:** High
**Status:** mitigated in #398: the rollback still runs the previous image on the newer schema, but the job and `deploy.log` now name the migrations it does not know ([report](reliability-report.md#rel-10-the-rollback-runs-old-code-on-a-migrated-database)).

### REL-11: `importFrom()` loses the cause when `finishRun` throws

```ts
// src/core/import/services/event-import.service.ts
const runId = await this.importedEventsRepository.startRun(provider.id);
try {
  const report = await this.importRecords(provider, runId, since);
  await this.importedEventsRepository.finishRun(runId, 'succeeded');
  return report;
} catch (error) {
  await this.importedEventsRepository.finishRun(runId, 'failed');
  throw error;
}
```

**Why it is dangerous:** the error that reaches the log is the one from `finishRun`, typically a database error, and it hides why the import failed.
**Potential impact:** the operator of the import; no user request is affected, and `run()` still goes on with the next provider.
**Fault:** `importFrom()` calls `finishRun(runId, 'failed')` inside `catch` with no guard, so an error thrown there replaces the original one.
**Error:** the original error is lost and `import_runs` still holds the status `running` that `startRun` wrote.
**Failure:** `run()` logs and reports the second error for that provider, not the cause, and the run stays `running` in the database.
**Severity:** Low

### REL-12: Any refresh error other than 401 reads as "no connection"

```ts
// app/src/api/session.ts, in renew()
} else if (response.status === 401) {
  await endSession();
} else {
  throw new Error('Could not renew the session');
}
```

```ts
// app/src/hooks/use-categories.ts: status 0 is what call() returns when the request throws
const error = failure && (failure.status === 0 ? 'Could not reach the server.' : 'Could not load categories.');
```

**Why it is dangerous:** the status the server sent is thrown away, so the screen states a cause that is not the real one.
**Potential impact:** every request of a signed-in user whose access token is due for renewal while the refresh endpoint answers with an error.
**Fault:** `renew` throws a plain `Error` for every answer except 200 and 401.
**Error:** `currentAccessToken` rejects inside the request middleware, so the request is never sent.
**Failure:** the screens show "Could not reach the server." although the API answered, for example with 503.
**Severity:** Low

### REL-14: Karabas pages without usable JSON-LD give a succeeded run

```ts
// src/infra/providers/provider-pages.ts: a block that is not JSON is dropped
try {
  const parsed: unknown = JSON.parse($(script).text());
  return Array.isArray(parsed) ? (parsed as unknown[]) : [parsed];
} catch {
  return [];
}
```

```ts
// src/infra/providers/karabas-event-provider.ts, in fetch(): only an HTTP failure counts as a failed section
const response = await this.http.get(url);
if (response.status !== 200) {
  throw new Error(`answered ${response.status}`);
}
events = jsonLdObjects(response.text).filter(isEvent);
// ...
if (failedSections === KARABAS_SECTIONS.length) {
  throw new Error('No Karabas section page could be fetched');
}
```

**Why it is dangerous:** the import depends on the markup of a site we do not control, and a change to it looks the same as a section with no events: no exception, no warning, only the usual `log` line with the counts.
**Potential impact:** the Karabas part of the catalog; the events imported earlier stay, but new and changed ones stop arriving until someone notices.
**Fault:** `jsonLdObjects` returns an empty list for a block that does not parse and for a page with no JSON-LD block at all, and `fetch` counts a section as failed only when the request throws or answers other than 200.
**Error:** every section page answers 200 and gives no events, so `failedSections` stays 0 and `fetch` returns an empty list instead of throwing.
**Failure:** `importFrom()` records the run as `succeeded` with 0 events fetched, `run()` reports no failed provider, and `src/import/main.ts` exits with 0, so whatever starts the import sees a successful run. The same happens without notice for a single section whose page broke.
**Severity:** Medium

## AI Usage Note

The findings were found by Vlad, checked with Claude Code against the code, then reviewed by the team.
