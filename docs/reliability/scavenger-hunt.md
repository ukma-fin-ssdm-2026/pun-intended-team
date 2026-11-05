# Reliability Scavenger Hunt

Reliability risks found in the Nearby API (`src/`) and mobile app (`app/`) for Lab 9, with their fault → error → failure chain.

## Findings

A error handling, B external dependencies, C input validation, D silent failures, E performance and blocking.

| ID | Finding | Category | Location |
|---|---|---|---|
| REL-01 | Database calls have no connection or statement timeout | B, E | `src/infra/prisma/prisma.service.ts` |
| REL-02 | App requests have no timeout; on Android they can wait forever | E, D | `app/src/api/client.ts` |
| REL-03 | Sign-out dispatches a navigation action no navigator handles | D | `app/src/app/(tabs)/profile.tsx`, `app/src/app/organization/settings.tsx` |
| REL-04 | `/health` answers "ok" without checking the database, so a deploy that cannot reach it is not rolled back | D, B | `src/api/system/controllers/system.controller.ts:21`, `src/infra/prisma/prisma.service.ts:14-18` |
| REL-05 | `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are read with `Number()` and not checked: an empty value blocks every sign-in or picks a random port | C, B | `src/api/common/config.ts` |
| REL-06 | A failed nightly backup skips the day without notice and leaves its `.partial` file on disk | D, B | `deploy/backup-db.sh:6`, `deploy/backup-db.sh:27-34` |
| REL-07 | When interests fail to load, profile edit hides the "more" button instead of showing an error | D | `app/src/app/profile-edit.tsx` |
| REL-08 | A refresh response lost after the server rotated the token makes the app retry with the old one, and the server ends the session | B, D | `app/src/api/session.ts:87-103`, `src/core/identity/services/sessions.service.ts:42-65` |
| REL-09 | A failure to fetch Google's keys (`ERR_JWKS_TIMEOUT`) reaches `unexpected()` of the exception filter and answers 500 instead of 503 | A, B | `src/infra/auth/jose-google-id-tokens.ts:9,31-34`, `src/api/app.module.ts:37` |
| REL-10 | The automatic rollback starts the previous image on a database whose migrations are already applied | B | `deploy/deploy-staging.sh:100,114-121` |
| REL-11 | If `finishRun` itself throws in `run()`, the original error is lost and the run stays `running` | A | `src/core/import/services/event-import.service.ts:29-39` |
| REL-12 | Any refresh answer other than 401 (for example 503) reaches the screens as "Could not reach the server." | D | `app/src/api/session.ts:96` |
| REL-13 | The genre `constructor` finds a property of `Object.prototype` in `CATEGORY_BY_GENRE`, and the resulting `TypeError` fails the whole import instead of skipping the record | A, C | `src/infra/providers/concert-ua-event-provider.ts:58`, `src/core/import/services/event-import.service.ts:65` |

## Details

### REL-01: Database calls without timeouts

**Fault:** the API's pg pool was created from a connection string alone, so pg's defaults applied: no connect, statement or query timeout.
**Error:** a call to a locked or silent database never ended, and the stuck calls held the pool's connections.
**Failure:** requests hung with no answer and, once the pool was exhausted, the whole API stopped answering, sign-in included.

### REL-02: App requests without a timeout

**Fault:** the app's API clients called `fetch` with no timeout, and React Native on Android sets none of its own.
**Error:** a request to a server that does not answer never settled, so the screen's loading state never ended.
**Failure:** the user sees an endless spinner with no error and no way out.

### REL-03: Sign-out dispatches an unhandled navigation action

**Fault:** the sign-out handlers of the profile and organization settings screens dispatch a navigation action that no navigator handles.
**Error:** the navigation action is dropped without a message.
**Failure:** the screen stays as it was after the user chose to sign out, or the history is not reset, with no error shown.

### REL-04: `/health` does not check the database

**Fault:** `getHealth` returns `{ status: 'ok' }` without touching the database (`system.controller.ts:21`), and `PrismaService` connects lazily, on the first query (`prisma.service.ts:14-18`), so nothing fails at startup.
**Error:** an API with no working database connection, for example with a wrong `MAIN_DATABASE_URL`, starts and reports "ok".
**Failure:** three consumers trust `/health`: the Docker `HEALTHCHECK` (`Dockerfile:28`), whose result decides the rollback in `deploy-staging.sh`, so a deploy that cannot reach the database is not rolled back; `service_healthy` on the API in `docker-compose.staging.yml:113`, which Caddy waits for; and the external uptime monitor of NFR REL-001 (`docs/requirements/requirements.md:118`), which counts 100% uptime while the database is dead. Users get errors on every request that needs the database.

### REL-05: `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are not checked

**Fault:** `config.ts` reads both with `Number(process.env.X ?? default)` and no validation, so an empty value becomes 0.
**Error:** the server gets port 0 (the system picks a random port), or the sign-in rate limit is 0 requests per minute.
**Failure:** nothing reaches the API on its expected port, or every request to a rate-limited sign-in endpoint is refused as too many requests.

### REL-06: A failed nightly backup skips the day

**Fault:** `backup-db.sh` runs under `set -e` (line 6), so a failed `pg_dump` ends the script, and nothing checks that a dump can be restored.
**Error:** the container restarts (`restart: unless-stopped`, `docker-compose.staging.yml:120`), the script takes the next 01:00 as tomorrow's (lines 27-34), and the `.partial` file stays on disk.
**Failure:** no backup exists for that day and nobody is told; a copy that cannot be restored is discovered only when it is needed.

### REL-07: Profile edit hides the "more" button when interests fail to load

**Fault:** `onMore` depends only on `interests.data`, and `interests.error` is never read.
**Error:** `useInterests` ends with an error and no data, and the screen treats that as "nothing to show".
**Failure:** the user cannot open the full list of interests and sees no error or retry.

### REL-08: A lost refresh response ends the session

**Fault:** the app saves the rotated refresh token only when the response arrives (`session.ts:87-103`), while the server rotates it before replying and revokes the session on any reuse of the old one (`sessions.service.ts:53-56`).
**Error:** the server holds the new token and the app still holds the old one after a response lost to a timeout or a dropped connection.
**Failure:** the next refresh sends the old token, the server treats it as stolen and ends the session, and the user is signed out of the account.

### REL-09: A Google key fetch failure answers 500

**Fault:** `JoseGoogleIdTokens` rethrows key-fetch errors (`ERR_JWKS_TIMEOUT` among them), but `app.module.ts` gives the exception filter only the database timeout check, so these errors are not recognised as unavailability.
**Error:** the filter takes the error for an unexpected one and logs it as an internal error.
**Failure:** the app gets `500 INTERNAL_ERROR` instead of a `503` it could retry when Google's keys cannot be fetched.

### REL-10: The rollback runs old code on a migrated database

**Fault:** the rollback in `deploy-staging.sh` restores the previous checkout and image only; the migrations applied by `migrate` are not reverted.
**Error:** the previous API version runs against a schema that is newer than it expects.
**Failure:** `deploy.log` and the job report "rolled back", while the API can fail on queries that the new schema changed.

### REL-11: `run()` loses the cause when `finishRun` throws

**Fault:** `run()` calls `finishRun(runId, 'failed')` inside `catch` with no guard, so an error thrown there replaces the original one.
**Error:** the original error is lost and `import_runs` still holds the status `running`.
**Failure:** the operator sees the second error, not the cause, and the run stays `running` in the database.

### REL-12: Any refresh error other than 401 reads as "no connection"

**Fault:** `renew` throws a plain `Error` for every answer except 200 and 401 (`session.ts:96`).
**Error:** `currentAccessToken` rejects inside the request middleware, so the request is never sent.
**Failure:** the screens show "Could not reach the server." although the API answered, for example with 503.

### REL-13: The genre `constructor` fails the whole import

**Fault:** `CATEGORY_BY_GENRE[genre.toLowerCase()]` reads a plain object with a key from the provider, so `constructor` finds the function on `Object.prototype` and the "no category" check passes.
**Error:** `categoryName` is a function, and `imported.categoryName.toLowerCase()` in `importRecords` throws a `TypeError`.
**Failure:** the run ends as `failed` and no further record of the feed is imported, instead of only the one record being skipped.

## AI Usage Note

The findings were found by Vlad, checked with Claude Code against the code, then reviewed by the team.
