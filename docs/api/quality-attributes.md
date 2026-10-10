<!-- Written with the help of Claude -->

# API Quality Attributes

Quality goals for the Nearby REST API (Lab 4). Every goal below has four parts: a **number**, a **failure condition** (the observation that proves the goal is not met), the **implementation** that is supposed to achieve it, and the **measurement** that produces the number. A goal that cannot fail measures nothing.

- **Scope:** every endpoint of the API in [`/src/api`](../../src/api) — 16 operations, 15 of them under `/api/v1` plus `/health` — and the OpenAPI specification generated from it ([`openapi-generated.yaml`](openapi-generated.yaml)). The endpoint list lives in [`api-design.md`](api-design.md); when it changes, this document changes with it.
- **Quality model:** ISO/IEC 25010:2023, the same as [`requirements.md` §4](../requirements/requirements.md).
- **Related documents:** [`requirements.md`](../requirements/requirements.md) · [`high-level-design.md`](../architecture/high-level-design.md) · [`catalog-access.md`](../architecture/mechanisms/catalog-access.md) · [`data-model.md`](../architecture/data-model.md) · [`threat-model.md`](../architecture/threat-model.md)
- **Status tags:**
  - **now** — the API returns stub data, but validation, status codes, error format and documentation are real, so the goal can pass or fail already. The result of the latest measurement follows the tag.
  - **contract** — depends on real authentication, a database or a deployed server. It is written down now so that the stubs and the spec do not contradict it, and it is **not** claimed as met until it is measured.

## Status at a Glance

| ID | Goal | Status | Latest result |
|---|---|---|---|
| QA-PERF-01 | Read latency | contract | Smoke run only (3 October): p99 66 ms at 50 connections |
| QA-SEC-01 | Input validation | now · met | 170 of 170 log rows pass |
| QA-SEC-02 | Bulk access | now · met | `limit=21` is rejected on both list endpoints; no page above 20 items |
| QA-SEC-03 | Data exposure | now · met | 0 sensitive names among 34 schema properties and parameters; no `X-Powered-By` header |
| QA-SEC-04 | Access control | now · met; revocation and the contact rule are contract | all 19 rows that expect `401` pass; non-admin and not-the-owner callers get `404`; expired and tampered tokens get `401` |
| QA-SEC-05 | Rate limiting | contract | Not implemented: 127,796 smoke requests on one token got no `429` |
| QA-SEC-06 | Dependency advisories | now · met | `npm audit` (3 October): 0 advisories of any severity (198 packages) |
| QA-REL-01 | Failure handling | now · met | 0 of 170 responses were `5xx`; the `500` path itself is not exercised (see goal) |
| QA-REL-02 | Availability | contract | No deployed backend yet |
| QA-FUNC-01 | Status codes | now · met | 16 of 16 documented operations match the spec; every success code in the log is the documented one |
| QA-INTC-01 | Error format | now · met (scope: the API's own code) | 0 non-2xx responses in the spec without `ErrorResponse`; 135 error responses in the log, none leaks internals |
| QA-MAIN-01 | Annotation completeness | now · met | 16 of 16 operations pass; the four list responses now have an example |
| QA-MAIN-02 | Spec freshness | now · met | Regenerated spec is byte-identical to the committed one |
| QA-MAIN-03 | Publication delay | now · not measured yet | Take the run time from the last `API docs (GitHub Pages)` run |
| QA-COMP-01 | API versioning | now · met | 15 of 16 operations under `/api/v1`; the one exception is `/health` |

## 1. Quality Goals

### Performance

**QA-PERF-01 · Read latency** — *contract*

- **Goal:** at 500 concurrent sessions, server-side response time of read requests is p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms
- **Failure condition:** any of the three thresholds is exceeded in a 10-minute run
- **Implementation:**
  - paginated list responses (at most 20 items, see QA-SEC-02)
  - stateless API apart from the in-memory stub data in `src/infra/stubs/data.ts`, which the database replaces (FLEX-002)
  - indexed queries for the catalog filters (planned)
- **Measurement:** k6 against staging, 500 sessions, 10 minutes. Stub-phase smoke run: 50 connections, 60 s, local server, `GET /api/v1/events`, thresholds p95 ≤ 1000 ms and no non-`2xx` answers:
  `TOKEN=$(curl -s -X POST http://localhost:4100/api/v1/auth/guest | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')`
  `npx autocannon -c 50 -d 60 -H "Authorization: Bearer $TOKEN" http://localhost:4100/api/v1/events`
  (autocannon reports p97.5 and p99; p97.5 ≤ 1000 ms implies p95 ≤ 1000 ms)
- **Latest smoke result:** 127,796 requests, all `2xx`, no errors or timeouts; p50 19 ms, p97.5 55 ms, p99 66 ms, max 793 ms. Run on 3 October, before the strict body schemas and the other fixes, and not repeated since. Run on a single-core sandbox with the load generator on the same machine and Node 22, so treat it as an order of magnitude, not a benchmark. It shows only that the stub API with validation is far from the limit; it says nothing about the database
- **Source:** PERF-001

### Security

**QA-SEC-01 · Input validation** — *now · met*

- **Goal:** 100% of invalid inputs (missing, wrong type, out of range, too long, malformed id, unknown body field, malformed JSON, a body that is not JSON) are rejected with `400` before any handler logic runs (`413` for a body over 100 kB)
- **Failure condition:** any invalid input returns `2xx` or `5xx`, or is silently accepted
- **Implementation:**
  - a zod schema for every path, query and body parameter, passed to `@Endpoint` and checked by `ValidationInterceptor` before the handler runs; all three parts are parsed together, so `details` lists every invalid field. The same schema produces the OpenAPI description, so the rules shown in Swagger UI cannot differ from the rules enforced
  - body schemas must reject unknown fields: a plain `z.object` drops them without any error, a `z.strictObject` rejects them. The five body schemas (`CreateEventBody`, `UpdateEventBody`, `CreateListingBody`, `CreateCategoryBody`, `UpdateCategoryBody`) are `z.strictObject`, and the spec shows `additionalProperties: false` on each. An unknown key gives `400 VALIDATION_ERROR` with one `details` entry: `field` is empty and the message, `Unknown fields are not allowed`, does not name the key
  - bodies must be JSON (`api-design.md` §1): `main.ts` turns off Nest's default parsers and registers only the JSON one, so a form-encoded body is not parsed and gets `400`
  - errors raised before a handler runs (broken JSON, body over 100 kB, broken URL encoding) are mapped to `400` / `413` by `ApiExpressAdapter`
- **Measurement:** validation log (§4), every endpoint × every input class; to be repeated in Swagger UI (**Try it out**) as the table in §4 shows, with `curl` for the rows Swagger UI cannot send
- **Latest result:** 170 of 170 rows pass. A body sent as `application/x-www-form-urlencoded` with valid fields is rejected with `400`. An unknown body field is now rejected with `400` on all five endpoints that take a body (8 rows), including the mass-assignment attempts (`status`, `source`, `organizationId` for an event; `status`, `authorId` for a listing)
- **Source:** Lab 4 criteria; threat model (main server, Tampering: input validation)

**QA-SEC-02 · Bulk access** — *now · met*

- **Goal:** the paginated list endpoints (`GET /events`, `GET /listings`) return at most 20 items per page; `limit` above 20 is rejected with `400`, not clamped ([`api-design.md`](api-design.md#pagination)). The two category lists are not paginated: they are small lookups, not user data
- **Failure condition:** any list response contains more than 20 items, or `limit=21` returns anything other than `400`
- **Implementation:**
  - maximum page size enforced in the shared `PageQuery` schema (`max(20)`, default 20)
  - no `total` in the page object, so the size of the catalog is not revealed
  - the catalog window is limited to 28 days
- **Measurement:** validation log — `limit=20` passes and `limit=21`, `0`, `-5`, `abc`, `1.5` are rejected on `GET /events`; `limit=20` passes and `21`, `0`, `abc` are rejected on `GET /listings`
- **Source:** catalog-access.md, rule 2; threat model TM-10

**QA-SEC-03 · Data exposure** — *now · met*

- **Goal:** zero response schemas contain credential or sensitive fields — `password`, `secret`, `code_hash`, `token_hash`, `push_token`, `date_of_birth`, the phone number (stored as `contact_identifier`; any `contact*` or `phone` name), email — except the contact fields of a mutual match (no such endpoint yet). Names are compared in lower case without underscores, because the API uses camelCase and the data model snake_case: `code_hash` and `codeHash` are the same name
- **Failure condition:** any such field name appears in a response schema or in a response body
- **Implementation:**
  - response shapes are zod schemas that list their fields explicitly; `ResponseSchemaInterceptor` parses every handler result with the success schema, so a field the schema does not list is dropped from the response
  - listing authors are exposed as `username` and `displayName` only
  - the `X-Powered-By: Express` header, which named the framework, is no longer sent
- **Measurement:** search of the property and parameter names in `openapi-generated.yaml` (the **Schemas** section of Swagger UI) for the listed names; inspection of the stub responses (the listing author row in §4) and of their headers
- **Latest result:** 0 hits among 34 property and parameter names (checked in the normalised form, also against `hash`, `failedSignins` and `lockedUntil` from the data model); no response in the log carries `X-Powered-By`
- **Source:** SEC-002, data-model §4

**QA-SEC-04 · Access control** — *now · met; revocation and the contact rule are contract*

- **Goal:** on every endpoint except `/health`, a missing or invalid token gets `401` in 100% of cases; a guest token on a signed-in endpoint gets `401`; a signed-in caller who is not an administrator gets `404` on `/api/v1/admin/*`, and a caller who does not own the resource gets `404` — never `403` ([`api-design.md`](api-design.md#error-handling), SEC-001). an expired or tampered token gets `401` (SEC-005). *Contract:* a revoked token gets `401`, and a contact request in any state other than two recorded acceptances gets `404`
- **Failure condition:** any of those cases answers anything else, or any `403` appears in the spec or in a response
- **Implementation:**
  - one global `AuthGuard`; the access level of each endpoint (`public`, `guest`, `user`, `admin`) is declared in `@Endpoint`, and the guard answers before validation, so a non-admin learns nothing about the admin API from a validation error
  - `AuthService.authenticate` accepts only a signed JWT: HS256, key found by `kid`, issuer, audience, type and expiry checked, claims parsed into the caller (#140)
  - mutual-acceptance rule checked on the server (planned)
- **Measurement:** validation log — each of the 15 protected endpoints is called with a missing or guest token; non-admin and not-the-owner rows; e2e tests with expired, tampered, `alg: none`, wrong-key, wrong-audience and malformed tokens; later, authorization tests per match state
- **Latest result:** all 19 rows that expect `401` pass, and all non-admin and not-the-owner rows return `404`. The e2e suite rejects all 10 bad-token cases with `401` (#140); revoked tokens wait for refresh tokens
- **Source:** SEC-005, SEC-001; threat model TM-11

**QA-SEC-05 · Rate limiting** — *contract*

- **Goal:** the 101st request within one minute on one token gets `429` with a `Retry-After` header; per-IP backstop at 1000 requests/min
- **Failure condition:** the 101st request is served with `2xx`, or the `429` has no `Retry-After`
- **Implementation:**
  - per-token limiter in the API (planned); `RATE_LIMITED` is already in `ErrorCode` and `429` is documented in `api-design.md`
  - per-IP backstop at the load balancer (planned)
- **Measurement:** test that sends 101 requests within one minute
- **Latest result:** not implemented. The smoke run sent 127,796 requests on one token in 60 s and never got a `429`, so this goal would fail if it were claimed now
- **Source:** SEC-007; catalog-access.md, rule 4; threat model TM-10

**QA-SEC-06 · Dependency advisories** — *now · met*

- **Goal:** zero Critical and zero High advisories in the dependencies of the API at release
- **Failure condition:** `npm audit --audit-level=high` exits with a non-zero status
- **Implementation:**
  - dependencies are installed from `package-lock.json` (`npm ci`), so the audit sees the versions that run
  - `src/mcp/` is a separate generated project with its own lock file and is outside this goal
- **Measurement:** `npm audit --audit-level=high` on the repository root. The CI gate that SEC-006 asks for is not set up yet, so this is a manual run
- **Latest result:** 3 October 2026: 0 advisories of any severity (info, low, moderate, high, critical) in the 198 packages installed from the lock file. Repeat it if a fix changed `package-lock.json`
- **Source:** SEC-006

### Reliability

**QA-REL-01 · Failure handling** — *now · met*

- **Goal:** zero `5xx` responses across the whole validation log, and the server keeps answering after it
- **Failure condition:** any `5xx` response, or the server process stops or restarts during the run
- **Implementation:**
  - `ApiExceptionFilter` turns any unexpected error into a `500` `ErrorResponse` with the generic message "Something went wrong"; the real error goes to the server log
  - the router answers unknown routes with `404`, and the same filter gives it the `ErrorResponse` shape
  - the server refuses to start if an endpoint is declared with zero or several success statuses, so a misdeclared endpoint cannot misbehave at run time
- **Measurement:** validation log (a `5xx` row is a failure); the server process is watched during the run
- **Latest result:** 0 of 170 responses were `5xx`; the server answered the last request of the log. On 3 October, before the fixes, a separate 60-second load run (127,796 requests) also ended with no errors or timeouts, and about 20 extra hand-made probes (`null` and array values, JSON nested 5000 levels, a `__proto__` key, a repeated query parameter, a 100 kB token, `HEAD` and `OPTIONS`) gave no `5xx` either; neither was repeated after the fixes. Not covered: the `500` path itself, because nothing in the stub API can fail; it needs a test with a repository that throws
- **Source:** Lab 4 criteria

**QA-REL-02 · Availability** — *contract (needs a deployed backend, bonus)*

- **Goal:** monthly uptime ≥ 99% on `/health` — about 7 h 12 min of downtime in a 30-day month — excluding maintenance announced at least 24 h ahead and totalling at most 2 h per month
- **Failure condition:** uptime below 99% in a calendar month, or announced maintenance above 2 h
- **Implementation:**
  - `GET /health` returns `200` and `{ "status": "ok" }`; it needs no token and is not versioned. Checked locally in the validation log. It is in the generated spec and in the endpoint tables of `api-design.md`
  - stateless server that can be restarted at any time
- **Measurement:** external uptime monitor polling `/health` every 5 minutes
- **Source:** REL-001

### Functional Suitability

**QA-FUNC-01 · Status codes** — *now · met*

- **Goal:** 100% of endpoints return exactly the status codes listed for them in `api-design.md` (`200` read or update, `201` create with a `Location` header, `204` delete, `400` invalid input, `401` no valid token, `404` unknown id or not allowed, `409` conflict, `422` business rule)
- **Failure condition:** any endpoint returns a code that differs from its row in `api-design.md`, or the generated spec lists a different set of codes
- **Implementation:**
  - `@Endpoint` takes exactly one success status per endpoint and sets it as the response code
  - `@Endpoint` adds `400`, `401` and (for admin endpoints) `404` to the spec itself; every other returned code is declared in the endpoint's `responses`
- **Measurement:** validation log, *expected* vs *actual* columns; comparison of the codes of every endpoint table row in `api-design.md` with the responses listed for the same operation in Swagger UI
- **Latest result:** 16 of 16 operations (`/health` included, now that it is in the endpoint tables) have the same code set in the spec and in `api-design.md`; every success in the log returns the documented code, every `201` carries `Location` and every `204` has an empty body
- **Source:** Lab 4 criteria

### Interaction Capability

**QA-INTC-01 · Error format** — *now · met*

- **Goal:** 100% of `4xx`/`5xx` responses produced by the API's own code use one shared `ErrorResponse` schema; zero stack traces, exception names or raw internal messages in any response body. A request that Node's HTTP parser rejects before the API runs (headers above about 16 kB) is outside this scope
- **Failure condition:** any error response in the spec or in a real call has a different shape, or exposes an exception name or a stack trace
- **Implementation:**
  - `ErrorResponse` is defined once in `common/schemas/errors.ts`; `ApiExceptionFilter` is the only place that builds an error body, so errors raised by Nest itself (router `404`, a stray `403` mapped to `404`) get the same shape
  - `@Endpoint` adds the `400` and `401` responses to every operation that needs them
  - technical detail goes to the log, not to the response (SEC-004)
- **Measurement:** every non-2xx response in the spec refers to `ErrorResponse` (checked in Swagger UI under each operation's **Responses**); the validation log checks every error response for the shape and for stack-trace patterns
- **Latest result:** 0 exceptions in the spec; all 135 error responses in the log have `error.code` and `error.message` and show no stack trace. This includes the 8 rejected unknown fields, the `422` for a past listing date, and errors raised outside the handlers: broken JSON, a 200 kB body, broken URL encoding, an unknown route and a wrong method. Outside the API's code: a 100 kB `Authorization` header gets an empty `431` from Node itself. Errors that Nest raises itself, such as the router's `404`, get our own message (`Not found`), not Nest's (`Cannot OPTIONS /api/v1/events`)
- **Source:** Lab 4 criteria, INTC-004

### Maintainability

**QA-MAIN-01 · Annotation completeness** — *now · met*

- **Goal:** 100% of operations in the generated spec have a summary, a description, a unique `operationId`, at least one tag, one success response with a schema and an example, a documented `400` for every input they accept, a documented `401` when they need a token, and a description on every parameter
- **Failure condition:** the check finds one operation without any of these
- **Implementation:**
  - `summary`, `tags`, `operationId`, `access` and `responses` are required fields of `@Endpoint`, so an endpoint cannot be declared without them (TypeScript refuses to compile); the server also refuses to start for a misdeclared status (`201` without `location`, `204` with a body)
  - examples are set once on a schema with `.meta({ example })` and reused by every response that refers to it
  - shared schemas (`Id`, `ErrorResponse`, `PageInfo`) are reused instead of copied
- **Measurement:** inspection of `openapi-generated.yaml` and of every operation in Swagger UI (summary, description, parameters, **Example Value** of the success response, documented `400` / `401`)
- **Latest result:** 16 of 16 operations pass. The four list operations — `GET /events`, `GET /listings`, `GET /categories`, `GET /admin/categories` — have an example on `EventsPage`, `ListingsPage`, `CategoryList` and `AdminCategoryList`. Summaries, descriptions, tags and unique `operationId`s are on all 16, `400` and `401` wherever needed, a description on every parameter
- **Source:** Lab 4 criteria

**QA-MAIN-02 · Spec freshness** — *now · met*

- **Goal:** the committed `openapi-generated.yaml` is identical to the spec regenerated from the code
- **Failure condition:** regenerating the spec on a clean checkout produces a diff against the committed file
- **Implementation:**
  - the spec is produced only from the code: `npm run docs:generate`, and in development every server start rewrites it; it is never edited by hand
  - the `CI` workflow regenerates the spec on every pull request and fails it if the committed spec is out of date; on `main`, `API docs (GitHub Pages)` runs the same check, only warns, and publishes the freshly generated spec
- **Measurement:** the `Generate and check API docs` job in `CI`; locally, `npm run docs:generate` followed by `git diff --exit-code docs/api/openapi-generated.yaml`
- **Latest result:** regenerating produced a file identical to the committed one, including the changes from the fixes (`additionalProperties: false` on the five bodies, examples on the four list responses)
- **Source:** Lab 4 criteria (code → docs)

**QA-MAIN-03 · Publication delay** — *now · not measured yet*

- **Goal:** after a merge to `main`, GitHub Pages shows the new spec within 10 minutes *(proposed)*
- **Failure condition:** the workflow fails, or the page still shows the old spec after 10 minutes
- **Implementation:**
  - the `API docs (GitHub Pages)` workflow generates the spec and deploys `docs/api` (Swagger UI and the spec) to Pages on every push to `main`
- **Measurement:** GitHub Actions run time, plus opening the Pages site after the run
- **Latest result:** to be filled in from the duration of the last workflow run on `main`
- **Source:** Lab 4 criteria

### Compatibility

**QA-COMP-01 · API versioning** — *now (bonus) · met*

- **Goal:** 100% of operations except `/health` live under the `/api/v1` prefix; `/health` stays unversioned because REL-001 names that exact path for the uptime monitor
- **Failure condition:** any operation path other than `/health` has no version prefix
- **Implementation:**
  - every path is defined once in `common/routes.ts` with its full prefix (`/api/v1/...`)
- **Measurement:** the list of paths in `openapi-generated.yaml` (shown in Swagger UI); the validation log tries an unknown version and a path without a prefix
- **Latest result:** 15 of 16 operations under `/api/v1`; `/api/v2/...` and an unprefixed `/events/{id}` both answer `404` with `ErrorResponse`
- **Source:** Lab 4 bonus, REL-001

## 2. Trade-off Analysis

| Attribute | Trade-off | Impact | Mitigation |
|---|---|---|---|
| Security (strict validation) | Every request is validated, and unknown fields are rejected instead of ignored | A small latency cost; a client that sends an extra field gets `400` | The smoke run (3 October, before the strict body schemas) shows p99 66 ms with validation on; the accepted fields are listed in the spec (`additionalProperties: false` on the five body schemas) |
| Security (response filtering) | Every response is parsed with its schema, so a field not in the schema never leaves the server (QA-SEC-03) | Extra work per response; a forgotten field in a schema silently disappears from the response | Same smoke run; the e2e tests and the validation log catch a missing field |
| Security (argon2id, sign-in lockout) | Sign-in is slower and locks after 5 failures in 15 min (SEC-002, SEC-007) | A real user who mistypes can be locked out for 15 minutes | Lockout message does not reveal whether the account exists; password reset by code stays available |
| Security (`404` instead of `403`) | A caller who may not access a resource gets the same `404` as for a missing one; non-admins get `404` on `/admin/*` | A client cannot tell "not yours" from "does not exist", which makes debugging harder | The `404` description in the spec says "or the caller may not access it"; the cause is in the server log |
| Safety (contacts after mutual accept) | Contacts appear only after both accept and the safety notice is acknowledged (SEC-001, SAFE-002) | Extra steps before two people can talk | The confirmation screen explains the steps in advance (UC-001) |
| Reliability (serve last import) | The catalog keeps serving the last import while the provider is down (REL-003) | Users may see stale events | Catalog shows a "last updated …" notice (FR-014) |
| Flexibility (stateless API) | No in-process cache, so every read goes to the database (FLEX-002) | Performance headroom is lower | PERF-001 test shows when it matters; adding Redis is the recorded next step (ADR-002). Until the database is connected the stubs keep state in memory, so two instances would show different data |
| Security (page size ≤ 20) | Browsing needs several requests; no "list all" endpoint | Less convenient for legitimate clients | Client loads the next page on scroll; the cap is reviewed against measured usage |
| Maintainability (code-first spec) | Every endpoint carries its summary, tags, schemas and response list, so each `@Endpoint` block is longer; generation is a CI step | Controllers are harder to read | `@Endpoint` keeps one endpoint in one block, and shared schemas (`Id`, `ErrorResponse`, `PageInfo`) are reused |
| Interaction capability (one `ErrorResponse`) | Detailed internal error text is not returned (INTC-004) | Less detail for the client; this is also what prevents information leaks | `details` names every invalid field; full detail goes to the log (SEC-004) |

## 3. Quality Attribute Scenarios

Three scenarios show how the most important goals behave in practice.

| Part | S1 — Invalid input | S2 — Code change reaches the docs | S3 — Catalog read at peak load |
|---|---|---|---|
| **Source** | any API client — the Expo app or a direct caller | a developer on the team | 500 concurrent user sessions (A-001) |
| **Stimulus** | sends a request with a missing, mistyped, out-of-range or unknown field | adds or changes an endpoint or a schema and merges to `main` | users browse the event catalog, 20 events per page |
| **Artifact** | every endpoint of the API | `openapi-generated.yaml` and the GitHub Pages site | main server, catalog list endpoint |
| **Environment** | normal operation, stub data | CI on pull request and on push to `main` | peak load on staging |
| **Response** | the request is rejected before the handler runs; the answer is `400` with `ErrorResponse` listing every invalid field; nothing is stored | the spec is regenerated from code, the freshness check passes, Pages is redeployed | the page of events is returned |
| **Response measure** | QA-SEC-01, QA-INTC-01: 100% of cases in the validation log; zero `2xx`/`5xx` answers | QA-MAIN-02: no diff between committed and regenerated spec; QA-MAIN-03: Pages updated within 10 minutes | QA-PERF-01: p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms |

## 4. Validation Log

Run for issue #98: every endpoint, every applicable input class, expected result from [`api-design.md`](api-design.md), actual result from the running API. A row passes only when both the status code and the error body match. The *Actual* column comes from requests sent to a local copy of the API on 4 October 2026 (stub data, fresh server), and every row was repeated in Swagger UI or with `curl`, as the table *Swagger UI verification* below shows.

### How to run it

Use the **local** Swagger UI: the one on GitHub Pages is read-only and has no **Try it out**. Start the API with `npm run dev` (Node 26) and open `http://localhost:4100/api-docs`. Click **Authorize**, paste a token for the caller of the row (see below), then use **Try it out** on each endpoint with each input class and compare the status code and the error body with the *Expected* column.

Stub data lives in memory and some rows create or delete objects, so restart the server before a full pass and go through each block of the log from top to bottom (for example, "the same listing again" needs the row before it).

**Rows Swagger UI cannot send are marked `(curl)`** in the log: 34 of 170 rows, in two groups

- **Blocked by Swagger UI itself (26 rows).** Before it sends a request, Swagger UI checks every query and path parameter against the schema and refuses a value that breaks it: a `limit` or `offset` that is not an integer or is out of range, and a value that is not a UUID in `categoryId`, `venueId` or `{id}`. To see the server's `400` for these, send them with `curl`.
- **Not sendable from Swagger UI (8 rows).** It offers only the documented `application/json` body, so `text/plain` and form-urlencoded bodies, a request with no body and no `Content-Type`, and the unknown routes need `curl`.

Broken JSON and a 200 kB body can be typed or pasted into the request body box of **Try it out**, so those rows are not marked. Add to the list whatever else Swagger UI turns out to refuse. Example:

```bash
curl -i -X POST http://localhost:4100/api/v1/admin/categories \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" -d "name=Zform"
```

**Dates.** The stub dates count from the day the server starts: events in 13, 16 and 20 days (the last one cancelled), listings in 7 and 16 days. The item counts in the *Actual* column therefore stay the same whenever the log is run.

Tokens come from `POST /api/v1/auth/guest`, or from `POST /api/v1/auth/sign-in` with the phone below and the password `nearby-dev-password` ([Trying It Out](api-design.md#trying-it-out)); `$ADMIN_TOKEN` above is the administrator's. They last 60 minutes.

| Caller | Phone | Use it for |
|---|---|---|
| a guest | — (`/auth/guest`) | catalog reads (`/events`, `/categories`); must get `401` on signed-in endpoints |
| Olena, Taras: two regular users | `+380501110001`, `+380501110002` | listings; "not the owner" cases (Taras deleting Olena's listing) |
| Podil Film Club: a verified organization with its own venue | `+380501110003` | publish, edit and cancel events |
| New Gallery: an organization awaiting verification | `+380501110004` | `ORGANIZATION_NOT_VERIFIED` |
| an administrator | `+380501110005` | `/api/v1/admin/categories`; any other caller gets `404` there |

**Input classes:**

| Class | Example |
|---|---|
| Missing required field | request body without a required property |
| Wrong type | text where a number is expected |
| Out of range | `limit=21`, `limit=0`, negative `offset` |
| Too long | string above the field's maximum length; body over 100 kB |
| Unknown field | extra property in the body |
| Malformed id | `abc` where a UUID is expected |
| Unknown id | well-formed id that does not exist → `404` |
| Boundary | exact minimum and maximum allowed value |
| Malformed request | body that is not JSON, wrong `Content-Type`, no body, broken URL encoding |
| Token | no token, invalid token, guest token on a signed-in endpoint |
| Wrong caller | not the owner, not an administrator → `404` |
| Business rule | valid body that a rule forbids → `422` |

### Swagger UI verification

Tick a row when every row of that endpoint in the log has been repeated in Swagger UI (and in `curl` where marked) and the *Actual* column still matches.

| Endpoint | Rows | `curl`: blocked by the UI | `curl`: not sendable from the UI | Sent from Swagger UI | Repeated in Swagger UI |
|---|---|---|---|---|---|
| `GET /health` | 1 | 0 | 0 | 1 | ✅ |
| `GET /events` | 21 | 10 | 0 | 11 | ✅ |
| `GET /events/{id}` | 9 | 3 | 0 | 6 | ✅ |
| `POST /events` | 29 | 0 | 2 | 27 | ✅|
| `PATCH /events/{id}` | 16 | 2 | 0 | 14 | ✅ |
| `POST /events/{id}/cancel` | 6 | 1 | 0 | 5 | ✅ |
| `GET /listings` | 8 | 4 | 0 | 4 | ✅ |
| `GET /listings/{id}` | 5 | 1 | 0 | 4 | ✅ |
| `POST /listings` | 22 | 0 | 0 | 22 | ✅ |
| `DELETE /listings/{id}` | 6 | 1 | 0 | 5 | ✅ |
| `GET /categories` | 2 | 0 | 0 | 2 | ✅ |
| `GET /admin/categories` | 4 | 0 | 0 | 4 | ✅ |
| `GET /admin/categories/{id}` | 6 | 2 | 0 | 4 | ✅ |
| `POST /admin/categories` | 12 | 0 | 1 | 11 | ✅ |
| `PATCH /admin/categories/{id}` | 11 | 1 | 0 | 10 | ✅ |
| `DELETE /admin/categories/{id}` | 7 | 1 | 0 | 6 | ✅ |
| Unknown routes and wrong methods | 5 | 0 | 5 | 0 | ✅ |
| **Total** | **170** | **26** | **8** | **136** | |

### Result

**170 of 170 rows pass; 0 responses were `5xx`** (QA-REL-01 requires zero).

| Endpoint | Rows | Pass | Fail |
|---|---|---|---|
| `GET /health` | 1 | 1 | 0 |
| `GET /events` | 21 | 21 | 0 |
| `GET /events/{id}` | 9 | 9 | 0 |
| `POST /events` | 29 | 29 | 0 |
| `PATCH /events/{id}` | 16 | 16 | 0 |
| `POST /events/{id}/cancel` | 6 | 6 | 0 |
| `GET /listings` | 8 | 8 | 0 |
| `GET /listings/{id}` | 5 | 5 | 0 |
| `POST /listings` | 22 | 22 | 0 |
| `DELETE /listings/{id}` | 6 | 6 | 0 |
| `GET /categories` | 2 | 2 | 0 |
| `GET /admin/categories` | 4 | 4 | 0 |
| `GET /admin/categories/{id}` | 6 | 6 | 0 |
| `POST /admin/categories` | 12 | 12 | 0 |
| `PATCH /admin/categories/{id}` | 11 | 11 | 0 |
| `DELETE /admin/categories/{id}` | 7 | 7 | 0 |
| Unknown routes and wrong methods (curl) | 5 | 5 | 0 |
| **Total** | **170** | **170** | **0** |

### Log

Click an endpoint to open its rows. *Expected* comes from `api-design.md`; *Actual* is the status code and error code the API returned.

<details>
<summary>`GET /health` — 1 of 1 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| no input, no token | 200, {"status":"ok"} | 200, {"status":"ok"} | ✅ |

</details>

<details>
<summary>`GET /events` — 21 of 21 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| no input | 200, at most 20 items | 200, 2 item(s), hasMore=false | ✅ |
| `limit=20` (boundary) | 200 | 200, 2 item(s), hasMore=false | ✅ |
| `limit=1` (boundary) | 200, 1 item, hasMore=true | 200, 1 item(s), hasMore=true | ✅ |
| `limit=21` (out of range) (curl) | 400, `VALIDATION_ERROR`, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `limit=0` (curl) | 400, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `limit=-5` (curl) | 400, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `limit=abc` (wrong type) (curl) | 400, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `limit=1.5` (not an integer) (curl) | 400, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `offset=-1` (curl) | 400, `query.offset` | 400 VALIDATION_ERROR (query.offset) | ✅ |
| `offset=abc` (curl) | 400, `query.offset` | 400 VALIDATION_ERROR (query.offset) | ✅ |
| `categoryId=abc` (malformed id) (curl) | 400, `query.categoryId` | 400 VALIDATION_ERROR (query.categoryId) | ✅ |
| `categoryId` of 300 characters (curl) | 400, `query.categoryId` | 400 VALIDATION_ERROR (query.categoryId) | ✅ |
| `venueId=abc` (curl) | 400, `query.venueId` | 400 VALIDATION_ERROR (query.venueId) | ✅ |
| `from=2026-13-45` (impossible date) | 400, `query.from` | 400 VALIDATION_ERROR (query.from) | ✅ |
| `from=tomorrow` | 400, `query.from` | 400 VALIDATION_ERROR (query.from) | ✅ |
| `from=2026-10-20&to=2026-10-10` (`to` before `from`) | 400, `query.to` | 400 VALIDATION_ERROR (query.to) | ✅ |
| `from=2020-01-01` (past date) | 200, clamped to today | 200, 2 item(s), hasMore=false | ✅ |
| `to=2030-01-01` (past the window) | 200, clamped to window end | 200, 2 item(s), hasMore=false | ✅ |
| `categoryId` = Cinema | 200, only Cinema events | 200, 1 item(s), hasMore=false | ✅ |
| no token | 401, `UNAUTHENTICATED` | 401 UNAUTHENTICATED | ✅ |
| invalid token `nonsense` | 401, `UNAUTHENTICATED` | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`GET /events/{id}` — 9 of 9 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| existing id `3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10` | 200, the event | 200, Open-air film night: Shadows of Forgotten Ancestors [published] | ✅ |
| second existing id `a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e` | 200, the event | 200, Contemporary art exhibition at the Arsenal [published] | ✅ |
| cancelled event `b8e5f1c3-2d4a-4c6b-9f0e-1a3d5c7b9e2f` | 200, `status: cancelled` | 200, Silent film with live piano [cancelled] | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| id of 300 characters (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| unknown id `11111111-1111-4111-8111-111111111111` | 404, `NOT_FOUND` | 404 NOT_FOUND | ✅ |
| nil id `00000000-0000-0000-0000-000000000000` (boundary) | 404, `NOT_FOUND` | 404 NOT_FOUND | ✅ |
| no token | 401 | 401 UNAUTHENTICATED | ✅ |
| broken URL encoding `/events/%FF` (curl) | 400, `VALIDATION_ERROR`, no `details` | 400 VALIDATION_ERROR | ✅ |

</details>

<details>
<summary>`POST /events` — 29 of 29 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| valid body (verified organization) | 201, the event, `Location` | 201, Film quiz night [published], Location /api/v1/events/{id} | ✅ |
| empty body `{}` (missing required fields) | 400, one `details` entry per required field | 400 VALIDATION_ERROR (body.title, body.description, body.categoryId, body.venueId, body.startsAt, body.endsAt) | ✅ |
| missing `title` | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title: 123` (wrong type) | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title: ""` (empty) | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title` of spaces only | 400, `body.title` (trimmed to empty) | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title` of 121 characters (too long) | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title` of 120 characters (boundary) | 201 | 201, xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx [published], Location /api/v1/events/{id} | ✅ |
| `description` of 5001 characters | 400, `body.description` | 400 VALIDATION_ERROR (body.description) | ✅ |
| `description` of 5000 characters (boundary) | 201 | 201, Film quiz night [published], Location /api/v1/events/{id} | ✅ |
| `categoryId: "abc"` (malformed id) | 400, `body.categoryId` | 400 VALIDATION_ERROR (body.categoryId) | ✅ |
| `startsAt: "2026-10-25"` (date, not date-time) | 400, `body.startsAt` | 400 VALIDATION_ERROR (body.startsAt) | ✅ |
| `startsAt` without offset | 400, `body.startsAt` | 400 VALIDATION_ERROR (body.startsAt) | ✅ |
| unknown field `foo` | 400, `VALIDATION_ERROR` (QA-SEC-01) | 400 VALIDATION_ERROR (body.) | ✅ |
| unknown fields `status`, `source`, `organizationId` (mass assignment) | 400 (QA-SEC-01); server-controlled fields never overwritten | 400 VALIDATION_ERROR (body.) | ✅ |
| `endsAt` before `startsAt` | 422, `EVENT_ENDS_BEFORE_START` | 422 EVENT_ENDS_BEFORE_START | ✅ |
| `endsAt` equal to `startsAt` (boundary) | 422, `EVENT_ENDS_BEFORE_START` | 422 EVENT_ENDS_BEFORE_START | ✅ |
| unknown category | 422, `REFERENCE_NOT_FOUND` | 422 REFERENCE_NOT_FOUND | ✅ |
| deactivated category (Poetry slams) | 422, `REFERENCE_NOT_FOUND` | 422 REFERENCE_NOT_FOUND | ✅ |
| another organization's venue | 422, `REFERENCE_NOT_FOUND` | 422 REFERENCE_NOT_FOUND | ✅ |
| organization awaiting verification (New Gallery) | 422, `ORGANIZATION_NOT_VERIFIED` | 422 ORGANIZATION_NOT_VERIFIED | ✅ |
| regular user (Olena), not an organization | 422, `ORGANIZATION_NOT_VERIFIED` | 422 ORGANIZATION_NOT_VERIFIED | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |
| no token | 401 | 401 UNAUTHENTICATED | ✅ |
| body is not valid JSON `{"title":` | 400, `VALIDATION_ERROR`, no `details` | 400 VALIDATION_ERROR | ✅ |
| body is a JSON array `[]` | 400, `VALIDATION_ERROR` | 400 VALIDATION_ERROR (body.) | ✅ |
| no body at all (curl) | 400, `VALIDATION_ERROR` | 400 VALIDATION_ERROR (body.) | ✅ |
| wrong `Content-Type` (`text/plain`) (curl) | 400, `VALIDATION_ERROR` | 400 VALIDATION_ERROR (body.) | ✅ |
| body of 200 kB | 413, `PAYLOAD_TOO_LARGE` | 413 PAYLOAD_TOO_LARGE | ✅ |

</details>

<details>
<summary>`PATCH /events/{id}` — 16 of 16 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| valid partial body `{title}` (own event) | 200, the updated event | 200, Open-air film night (renamed) [published] | ✅ |
| empty body `{}` | 200, nothing changes | 200, Open-air film night (renamed) [published] | ✅ |
| `title: ""` | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title: 123` (wrong type) | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title` of 121 characters | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| unknown field `foo` | 400, `VALIDATION_ERROR` (QA-SEC-01) | 400 VALIDATION_ERROR (body.) | ✅ |
| `status: "cancelled"` in the body (not an editable field) | 400 (QA-SEC-01); the event stays `published` | 400 VALIDATION_ERROR (body.) | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| malformed id and invalid body together (curl) | 400, both `params.id` and `body.title` in `details` | 400 VALIDATION_ERROR (params.id, body.title) | ✅ |
| unknown id | 404, `NOT_FOUND` | 404 NOT_FOUND | ✅ |
| event of nobody (imported) | 404, `NOT_FOUND` (not the caller's own) | 404 NOT_FOUND | ✅ |
| regular user edits an organization's event | 404, `NOT_FOUND` (never `403`) | 404 NOT_FOUND | ✅ |
| cancelled event | 422, `EVENT_CANCELLED` | 422 EVENT_CANCELLED | ✅ |
| `endsAt` before the stored `startsAt` | 422, `EVENT_ENDS_BEFORE_START` | 422 EVENT_ENDS_BEFORE_START | ✅ |
| unknown category | 422, `REFERENCE_NOT_FOUND` | 422 REFERENCE_NOT_FOUND | ✅ |
| no token | 401 | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`POST /events/{id}/cancel` — 6 of 6 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| own event | 200, `status: cancelled` | 200, Film quiz night [cancelled] | ✅ |
| the same event again (idempotent) | 200, still `cancelled` | 200, Film quiz night [cancelled] | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| unknown id | 404 | 404 NOT_FOUND | ✅ |
| someone else's event | 404 (never `403`) | 404 NOT_FOUND | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`GET /listings` — 8 of 8 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| no input | 200, at most 20 items | 200, 2 item(s), hasMore=false | ✅ |
| `limit=20` (boundary) | 200 | 200, 2 item(s), hasMore=false | ✅ |
| `limit=21` (curl) | 400, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `limit=0` (curl) | 400, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `limit=abc` (curl) | 400, `query.limit` | 400 VALIDATION_ERROR (query.limit) | ✅ |
| `offset=-1` (curl) | 400, `query.offset` | 400 VALIDATION_ERROR (query.offset) | ✅ |
| guest token | 401 (guests cannot read listings) | 401 UNAUTHENTICATED | ✅ |
| no token | 401 | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`GET /listings/{id}` — 5 of 5 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| existing id `9e4a6c8d-0f2b-4d4e-8a6c-8d0f2b4d6e09` | 200, the listing, no contact fields | 200, Looking for company for the Arsenal exhibition [active] | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| unknown id | 404 | 404 NOT_FOUND | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |
| removed listing | 404 | 404 NOT_FOUND | ✅ |

</details>

<details>
<summary>`POST /listings` — 22 of 22 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| valid body | 201, the listing, `Location` | 201, Looking for company for an exhibition [active], Location /api/v1/listings/{id} | ✅ |
| valid body with `eventId` | 201, `eventId` set | 201, Looking for company for an exhibition [active], Location /api/v1/listings/{id} | ✅ |
| empty body `{}` | 400, `details` for every required field | 400 VALIDATION_ERROR (body.categoryId, body.title, body.description, body.date) | ✅ |
| missing `title` | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title: 123` (wrong type) | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title` of 121 characters | 400, `body.title` | 400 VALIDATION_ERROR (body.title) | ✅ |
| `title` of 120 characters (boundary) | 201 | 201, xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx [active], Location /api/v1/listings/{id} | ✅ |
| `description` of 2001 characters | 400, `body.description` | 400 VALIDATION_ERROR (body.description) | ✅ |
| `description` of 2000 characters (boundary) | 201 | 201, Looking for company for an exhibition [active], Location /api/v1/listings/{id} | ✅ |
| `date: "2026-02-30"` (impossible date) | 400, `body.date` | 400 VALIDATION_ERROR (body.date) | ✅ |
| `date: "tomorrow"` | 400, `body.date` | 400 VALIDATION_ERROR (body.date) | ✅ |
| `date` as a date-time | 400, `body.date` | 400 VALIDATION_ERROR (body.date) | ✅ |
| `categoryId: "abc"` | 400, `body.categoryId` | 400 VALIDATION_ERROR (body.categoryId) | ✅ |
| unknown field `foo` | 400, `VALIDATION_ERROR` (QA-SEC-01) | 400 VALIDATION_ERROR (body.) | ✅ |
| unknown fields `status`, `authorId` (mass assignment) | 400 (QA-SEC-01); the listing stays `active`, the author is the caller | 400 VALIDATION_ERROR (body.) | ✅ |
| unknown category | 422, `REFERENCE_NOT_FOUND` | 422 REFERENCE_NOT_FOUND | ✅ |
| deactivated category | 422, `REFERENCE_NOT_FOUND` | 422 REFERENCE_NOT_FOUND | ✅ |
| unknown `eventId` | 422, `REFERENCE_NOT_FOUND` | 422 REFERENCE_NOT_FOUND | ✅ |
| cancelled event | 422, `EVENT_CANCELLED` | 422 EVENT_CANCELLED | ✅ |
| `date` in the past (`2020-01-01`) | 422, `LISTING_DATE_IN_PAST` | 422 LISTING_DATE_IN_PAST | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |
| body is not valid JSON | 400, `VALIDATION_ERROR`, no `details` | 400 VALIDATION_ERROR | ✅ |

</details>

<details>
<summary>`DELETE /listings/{id}` — 6 of 6 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| someone else's listing | 404 (never `403`) | 404 NOT_FOUND | ✅ |
| own listing | 204, empty body | 204, empty body | ✅ |
| the same listing again | 404 (already removed) | 404 NOT_FOUND | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| unknown id | 404 | 404 NOT_FOUND | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`GET /categories` — 2 of 2 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| guest token | 200, active categories only, no `isActive` | 200, 3 item(s), hasMore=n/a | ✅ |
| no token | 401 | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`GET /admin/categories` — 4 of 4 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| administrator | 200, all categories with `isActive` | 200, 4 item(s), hasMore=n/a | ✅ |
| regular user | 404, `NOT_FOUND` (the admin API is hidden) | 404 NOT_FOUND | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |
| no token | 401 | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`GET /admin/categories/{id}` — 6 of 6 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| existing id | 200 | 200, Cinema | ✅ |
| deactivated category | 200, `isActive: false` | 200, Poetry slams | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| unknown id | 404 | 404 NOT_FOUND | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |
| regular user, malformed id (curl) | 404 (access is checked before the id) | 404 NOT_FOUND | ✅ |

</details>

<details>
<summary>`POST /admin/categories` — 12 of 12 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| valid body `{name}` | 201, `isActive: true`, `Location` | 201, Workshops, Location /api/v1/admin/categories/{id} | ✅ |
| empty body `{}` | 400, `body.name` | 400 VALIDATION_ERROR (body.name) | ✅ |
| `name: 5` (wrong type) | 400, `body.name` | 400 VALIDATION_ERROR (body.name) | ✅ |
| `name: ""` | 400, `body.name` | 400 VALIDATION_ERROR (body.name) | ✅ |
| `name` of 61 characters | 400, `body.name` | 400 VALIDATION_ERROR (body.name) | ✅ |
| `name` of 60 characters (boundary) | 201 | 201, yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy, Location /api/v1/admin/categories/{id} | ✅ |
| `isActive: "yes"` (wrong type) | 400, `body.isActive` | 400 VALIDATION_ERROR (body.isActive) | ✅ |
| unknown field `foo` | 400, `VALIDATION_ERROR` (QA-SEC-01) | 400 VALIDATION_ERROR (body.) | ✅ |
| wrong `Content-Type` (`application/x-www-form-urlencoded`, valid fields) (curl) | 400, `VALIDATION_ERROR` (`api-design.md` §1: JSON in and out) | 400 VALIDATION_ERROR (body.) | ✅ |
| duplicate name `cinema` (case-insensitive) | 409, `CONFLICT` | 409 CONFLICT | ✅ |
| regular user | 404 (never `403`) | 404 NOT_FOUND | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |

</details>

<details>
<summary>`PATCH /admin/categories/{id}` — 11 of 11 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| `{isActive: false}` | 200, `isActive: false` | 200, Workshops | ✅ |
| `{name}` (rename) | 200, new name | 200, Masterclasses | ✅ |
| empty body `{}` | 200, nothing changes | 200, Masterclasses | ✅ |
| `name: ""` | 400, `body.name` | 400 VALIDATION_ERROR (body.name) | ✅ |
| `isActive: "no"` | 400, `body.isActive` | 400 VALIDATION_ERROR (body.isActive) | ✅ |
| unknown field `foo` | 400, `VALIDATION_ERROR` (QA-SEC-01) | 400 VALIDATION_ERROR (body.) | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| unknown id | 404 | 404 NOT_FOUND | ✅ |
| rename to an existing name | 409, `CONFLICT` | 409 CONFLICT | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |
| regular user | 404 | 404 NOT_FOUND | ✅ |

</details>

<details>
<summary>`DELETE /admin/categories/{id}` — 7 of 7 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| category in use (Cinema) | 409, `CONFLICT` | 409 CONFLICT | ✅ |
| malformed id `abc` (curl) | 400, `params.id` | 400 VALIDATION_ERROR (params.id) | ✅ |
| unknown id | 404 | 404 NOT_FOUND | ✅ |
| regular user | 404 | 404 NOT_FOUND | ✅ |
| guest token | 401 | 401 UNAUTHENTICATED | ✅ |
| unused category | 204, empty body | 204, empty body | ✅ |
| the same category again | 404 | 404 NOT_FOUND | ✅ |

</details>

<details>
<summary>Unknown routes and wrong methods (curl) — 5 of 5 pass</summary>

| Input | Expected | Actual | Pass |
|---|---|---|---|
| unknown route: `GET /api/v1/nope` | 404, `NOT_FOUND`, `ErrorResponse` shape | 404 NOT_FOUND | ✅ |
| unknown route: `GET /api/v2/events/{id}` (unknown API version) | 404, `NOT_FOUND` | 404 NOT_FOUND | ✅ |
| unknown route: `GET /events/{id}` without the version prefix | 404, `NOT_FOUND` | 404 NOT_FOUND | ✅ |
| wrong method: `DELETE /api/v1/events/{id}` | 404, `NOT_FOUND` | 404 NOT_FOUND | ✅ |
| wrong method: `PUT /api/v1/listings/{id}` | 404, `NOT_FOUND` | 404 NOT_FOUND | ✅ |

</details>

### Error bodies

Real responses, so the format in §1 (QA-INTC-01) can be checked by eye. Every error has `error.code` and `error.message`; clients branch on `code`.

```jsonc
// GET /api/v1/events?limit=21  →  400
{"error":{"code":"VALIDATION_ERROR","message":"The request is invalid","details":[{"location":"query","field":"limit","message":"Too big: expected number to be <=20"}]}}

// POST /api/v1/listings with body {}  →  400, every missing field listed
{"error":{"code":"VALIDATION_ERROR","message":"The request is invalid","details":[{"location":"body","field":"categoryId","message":"Invalid input: expected string, received undefined"},{"location":"body","field":"title","message":"Invalid input: expected string, received undefined"},{"location":"body","field":"description","message":"Invalid input: expected string, received undefined"},{"location":"body","field":"date","message":"Invalid input: expected string, received undefined"}]}}

// POST /api/v1/events with body {"title":  →  400, no details: no single field is at fault
{"error":{"code":"VALIDATION_ERROR","message":"The request body is not valid JSON"}}

// GET /api/v1/events without a token  →  401
{"error":{"code":"UNAUTHENTICATED","message":"A valid access token is required"}}

// GET /api/v1/admin/categories as a regular user  →  404, the admin API is hidden
{"error":{"code":"NOT_FOUND","message":"Not found"}}

// POST /api/v1/admin/categories with name "cinema"  →  409
{"error":{"code":"CONFLICT","message":"A category with this name already exists"}}

// POST /api/v1/events by an organization awaiting verification  →  422
{"error":{"code":"ORGANIZATION_NOT_VERIFIED","message":"Only a verified organization can publish events"}}

// POST /api/v1/events with a 200 kB body  →  413
{"error":{"code":"PAYLOAD_TOO_LARGE","message":"The request body is too large"}}
```

## AI Usage Note

Oleh developed the original ideas, goals, and trade-off table. Claude helped structure and formalize the material, added its own ideas, prepared the English text and scenarios, suggested figures, and produced the validation log and proposed fixes.

Claude reviewed the document and project: it ran the type check and end-to-end tests (32 of 32 passed), compared the regenerated specification with the committed version, reran the validation log against a fresh server, audited dependencies, and checked the sources cited in the goals against the relevant documents. The fixes and decisions that followed were also reproduced.

I then reviewed the material myself.

