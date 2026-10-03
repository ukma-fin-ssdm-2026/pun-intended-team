# API Quality Attributes

Quality goals for the Nearby REST API (Lab 4). Every goal below has four parts: a **number**, a **failure condition** (the observation that proves the goal is not met), the **implementation** that is supposed to achieve it, and the **measurement** that produces the number. A goal that cannot fail measures nothing.

- **Scope:** every endpoint of the API in [`/src/api`](../../src/api) and the OpenAPI specification generated from it ([`openapi-generated.yaml`](openapi-generated.yaml)). The endpoint list lives in [`api-design.md`](api-design.md); when it changes, this document changes with it.
- **Quality model:** ISO/IEC 25010:2023, the same as [`requirements.md` §4](../requirements/requirements.md).
- **Related documents:** [`requirements.md`](../requirements/requirements.md) · [`high-level-design.md`](../architecture/high-level-design.md) · [`catalog-access.md`](../architecture/mechanisms/catalog-access.md) · [`data-model.md`](../architecture/data-model.md)
- 
- **now** — the API returns stub data, but validation, status codes, error format and documentation are real, so the goal can pass or fail already.
- **contract** — depends on real authentication, a database or a deployed server. It is written down now so that the stubs and the spec do not contradict it, and it is **not** claimed as met until it is measured.

## 1. Quality Goals

### Performance

**QA-PERF-01 · Read latency** — *contract*

- **Goal:** at 500 concurrent sessions, server-side response time of read requests is p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms
- **Failure condition:** any of the three thresholds is exceeded in a 10-minute run
- **Implementation:**
  - paginated list responses (at most 20 items, see QA-SEC-02)
  - stateless API, no in-process session state (FLEX-002)
  - indexed queries for the catalog filters (planned)
- **Measurement:** k6 against staging, 500 sessions, 10 minutes. Stub-phase smoke run *(proposed)*: 50 virtual users, 60 s, local server, p95 ≤ 1000 ms
- **Source:** PERF-001

### Security

**QA-SEC-01 · Input validation** — *now*

- **Goal:** 100% of invalid inputs (missing, wrong type, out of range, too long, unknown body field) are rejected with `400` before any handler logic runs
- **Failure condition:** any invalid input returns `2xx` or `5xx`, or is silently accepted
- **Implementation:**
  - a zod schema for every path, query and body parameter, checked by `defineRoute` before the handler runs; the same schema produces the OpenAPI description, so the rules shown in Swagger UI cannot differ from the rules enforced
  - body schemas written with `z.strictObject`: a plain `z.object` drops unknown fields without any error instead of rejecting them
- **Measurement:** validation log (§4) — every endpoint × every input class, run through Swagger UI (**Try it out**); later as automated tests
- **Source:** Lab 4 criteria, SAFE-001

**QA-SEC-02 · Bulk access** — *now (nothing to test until a list endpoint exists)*

- **Goal:** list endpoints return at most 20 items per page; `limit` above 20 is rejected with `400` *(rejection vs. clamping to be confirmed in `api-design.md`)*
- **Failure condition:** any list response contains more than 20 items, or `limit=21` returns more than 20 items
- **Implementation:**
  - maximum page size enforced in the query schema (`z.number().max(20)`)
  - no "list all" endpoint
- **Measurement:** validation log — `limit=20` passes and `limit=21` is rejected on every list endpoint
- **Source:** catalog-access.md, rule 2

**QA-SEC-03 · Data exposure** — *now*

- **Goal:** zero response schemas contain credential or sensitive fields — password, `secret`, `code_hash`, `token_hash`, `push_token`, `date_of_birth`, phone number — except the contact fields of a mutual match
- **Failure condition:** any such field name appears in a response schema or in a response body
- **Implementation:**
  - response shapes are zod schemas that list their fields explicitly (`Event`, `HealthResponse`)
  - a database row is mapped to the response schema before it is returned (planned, once the database is connected)
- **Measurement:** search over the generated spec for the listed names, plus inspection of the stub responses in Swagger UI
- **Source:** SEC-002, data-model §4

**QA-SEC-04 · Access control** — *contract*

- **Goal:** a missing, expired, tampered or revoked token on a protected endpoint gets `401` in 100% of cases; a contact request in any state other than two recorded acceptances gets `403` in 100% of cases
- **Failure condition:** any protected endpoint answers anything other than `401` / `403` in those cases
- **Implementation:**
  - token guard on protected routes (planned)
  - mutual-acceptance rule checked on the server (planned)
  - `401` and `403` already documented in the annotations of protected endpoints
- **Measurement:** authorization tests per match state, once the guard exists
- **Source:** SEC-005, SEC-001

**QA-SEC-05 · Rate limiting** — *contract*

- **Goal:** the 101st request within one minute on one token gets `429` with a `Retry-After` header; per-IP backstop at 1000 requests/min
- **Failure condition:** the 101st request is served with `2xx`, or the `429` has no `Retry-After`
- **Implementation:**
  - per-token limiter in the API (planned)
  - per-IP backstop at the load balancer (planned)
- **Measurement:** test that sends 101 requests within one minute
- **Source:** SEC-007

Stub endpoints have no authentication and no rate limiter, so QA-SEC-04 and QA-SEC-05 are not claimed as passing.

### Reliability

**QA-REL-01 · Failure handling** — *now*

- **Goal:** zero `5xx` responses across the whole validation log, and the server keeps answering after it *(proposed)*
- **Failure condition:** any `5xx` response, or the server process stops or restarts during the run
- **Implementation:**
  - `errorHandler` (`lib/errors.ts`) turns any thrown error into a `500` `ErrorResponse` with the generic message "Something went wrong"; the real error goes to the server log
  - `notFoundHandler` answers unknown routes with a `404` `ErrorResponse`
- **Measurement:** validation log (a `5xx` row is a failure); the server process is watched during the run
- **Source:** Lab 4 criteria

**QA-REL-02 · Availability** — *contract (needs a deployed backend, bonus)*

- **Goal:** monthly uptime ≥ 99% on `/health` — about 7 h 12 min of downtime in a 30-day month — excluding maintenance announced at least 24 h ahead and totalling at most 2 h per month
- **Failure condition:** uptime below 99% in a calendar month, or announced maintenance above 2 h
- **Implementation:**
  - `GET /health` endpoint returning `200` and `{ "status": "ok" }` (merged in #93; to be added to `api-design.md`)
  - stateless server that can be restarted at any time
- **Measurement:** external uptime monitor polling `/health` every 5 minutes
- **Source:** REL-001

### Functional Suitability

**QA-FUNC-01 · Status codes** — *now*

- **Goal:** 100% of endpoints return exactly the status codes listed for them in `api-design.md` (`200` read, `201` create, `204` delete, `404` unknown id, `400` invalid input)
- **Failure condition:** any endpoint returns a code that differs from its row in `api-design.md`
- **Implementation:**
  - the success code set explicitly on every handler
  - every returned code documented in the annotations
- **Measurement:** validation log, *expected* vs *actual* columns
- **Source:** Lab 4 criteria

### Interaction Capability

**QA-INTC-01 · Error format** — *now*

- **Goal:** 100% of `4xx`/`5xx` responses use one shared `ErrorResponse` schema; zero stack traces, exception names or raw internal messages in any response body
- **Failure condition:** any error response in the spec or in a real call has a different shape, or exposes an exception name or a stack trace
- **Implementation:**
  - `ErrorResponse` defined once in `schemas/errors.ts`; `sendError` is the only function that builds an error body
  - `defineRoute` adds the `400` response to every operation that accepts input
  - technical detail goes to the log, not to the response (SEC-004)
- **Measurement:** check over the generated spec (every non-2xx response refers to `ErrorResponse`), plus inspection of error bodies in the validation log
- **Source:** Lab 4 criteria, INTC-004

### Maintainability

**QA-MAIN-01 · Annotation completeness** — *now*

- **Goal:** 100% of operations in the generated spec have a summary, at least one success response with a schema and an example, and a documented error response for every input they accept
- **Failure condition:** the check finds one operation without a summary, a success example or its error responses
- **Implementation:**
  - `summary`, `tags`, `operationId` and `responses` are required fields of `defineRoute`, so an endpoint cannot be registered without them (TypeScript refuses to compile)
  - examples are set once on a schema with `.meta({ example })` and reused by every response that refers to it
  - shared schemas reused instead of copied
- **Measurement:** check over `openapi-generated.yaml` (planned script, run in CI); manual spot-check in Swagger UI until then
- **Source:** Lab 4 criteria

**QA-MAIN-02 · Spec freshness** — *now*

- **Goal:** the committed `openapi-generated.yaml` is identical to the spec regenerated from the code
- **Failure condition:** regenerating the spec on a clean checkout produces a diff against the committed file
- **Implementation:**
  - the spec is produced only from the code: `npm run docs:generate`, and in development every server start rewrites it; it is never edited by hand
  - CI regenerates the spec and compares (planned, issue #90)
- **Measurement:** CI step — regenerate, then `git diff --exit-code docs/api/openapi-generated.yaml`
- **Source:** Lab 4 criteria (code → docs)

**QA-MAIN-03 · Publication delay** — *now*

- **Goal:** after a merge to `main`, GitHub Pages shows the new spec within 10 minutes *(proposed)*
- **Failure condition:** the workflow fails, or the page still shows the old spec after 10 minutes
- **Implementation:**
  - GitHub Actions workflow that generates the spec and deploys Swagger UI to Pages on every push to `main`
- **Measurement:** GitHub Actions run time, plus opening the Pages site after the run
- **Source:** Lab 4 criteria

### Compatibility

**QA-COMP-01 · API versioning** — *now (bonus)*

- **Goal:** 100% of operations except `/health` live under the `/api/v1` prefix; `/health` stays unversioned because REL-001 names that exact path for the uptime monitor
- **Failure condition:** any operation path other than `/health` has no version prefix
- **Implementation:**
  - every path is defined once in `routes.ts` with its full prefix (`/api/v1/...`)
- **Measurement:** check over the paths of the generated spec
- **Source:** Lab 4 bonus, REL-001

## 2. Trade-off Analysis

| Attribute | Trade-off | Impact | Mitigation |
|---|---|---|---|
| Security (strict validation) | Every request is validated, and unknown fields are rejected instead of ignored | A small latency cost; a client that sends an extra field gets `400` | Check p95 in the QA-PERF-01 smoke run; list accepted fields in the spec |
| Security (argon2id, sign-in lockout) | Sign-in is slower and locks after 5 failures in 15 min (SEC-002, SEC-007) | A real user who mistypes can be locked out for 15 minutes | Lockout message does not reveal whether the account exists; password reset by code stays available |
| Safety (contacts after mutual accept) | Contacts appear only after both accept and the safety notice is acknowledged (SEC-001, SAFE-002) | Extra steps before two people can talk | The confirmation screen explains the steps in advance (UC-001) |
| Reliability (serve last import) | The catalog keeps serving the last import while the provider is down (REL-003) | Users may see stale events | Catalog shows a "last updated …" notice (FR-014) |
| Flexibility (stateless API) | No in-process cache, so every read goes to the database (FLEX-002) | Performance headroom is lower | PERF-001 test shows when it matters; Redis or HTTP caching is the recorded next step (ADR-002) |
| Security (page size ≤ 20) | Browsing needs several requests; no "list all" endpoint | Less convenient for legitimate clients | Client loads the next page on scroll; the cap is reviewed against measured usage |
| Maintainability (code-first spec) | Every endpoint carries its summary, tags, schemas and response list, so each route block is longer; generation is a CI step | Controllers are harder to read | `defineRoute` keeps one endpoint in one block, and shared schemas (`Id`, `ErrorResponse`) are reused |
| Interaction capability (one `ErrorResponse`) | Detailed internal error text is not returned (INTC-004) | Less detail for the client; this is also what prevents information leaks | An optional field names the invalid input fields; full detail goes to the log (SEC-004) |

## 3. Quality Attribute Scenarios

Three scenarios show how the most important goals behave in practice.

| Part | S1 — Invalid input | S2 — Code change reaches the docs | S3 — Catalog read at peak load |
|---|---|---|---|
| **Source** | any API client — the Expo app or a direct caller | a developer on the team | 500 concurrent user sessions (A-001) |
| **Stimulus** | sends a request with a missing, mistyped, out-of-range or unknown field | adds or changes an endpoint or a schema and merges to `main` | users browse the event catalog, 20 events per page |
| **Artifact** | every endpoint of the API | `openapi-generated.yaml` and the GitHub Pages site | main server, catalog list endpoint |
| **Environment** | normal operation, stub data | CI on push to `main` | peak load on staging |
| **Response** | the request is rejected before the handler runs; the answer is `400` with `ErrorResponse` naming the field; nothing is stored | the spec is regenerated from code, the freshness check passes, Pages is redeployed | the page of events is returned |
| **Response measure** | QA-SEC-01, QA-INTC-01: 100% of cases in the validation log; zero `2xx`/`5xx` answers | QA-MAIN-02: no diff between committed and regenerated spec; QA-MAIN-03: Pages updated within 10 minutes | QA-PERF-01: p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms |

## 4. Validation Log

Filled in by the Quality Lead after the endpoints are merged (issue #98). Run the API with `npm run dev` and open **Swagger UI** at `http://localhost:4100/api-docs`; try every endpoint with **Try it out** and every applicable input class below. *Expected* comes from `api-design.md`; *Actual* is what Swagger UI returned. A row passes only when both the status code and the error body match. Rows for routes the spec does not document are tried with `curl` or the browser address bar, because Swagger UI only offers documented operations.

**Input classes:**

| Class | Example |
|---|---|
| Missing required field | request body without a required property |
| Wrong type | text where a number is expected |
| Out of range | `limit=21`, `limit=0`, negative page number |
| Too long | string far above the field's maximum length |
| Unknown field | extra property in the body |
| Malformed id | `abc` where a UUID is expected |
| Unknown id | well-formed id that does not exist → `404` |
| Boundary | exact minimum and maximum allowed value |

**Log — endpoints merged in #93:**

| Endpoint | Input | Expected | Actual | Pass |
|---|---|---|---|---|
| `GET /health` | no input | `200`, `{"status":"ok"}` | — | — |
| `GET /api/v1/events/{id}` | existing id `3f1c2a9e-8b4d-4e2a-9c71-5d0e6b7a8f10` | `200`, the event | — | — |
| `GET /api/v1/events/{id}` | second existing id `a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e` | `200`, the event | — | — |
| `GET /api/v1/events/{id}` | malformed id `abc` | `400`, `VALIDATION_ERROR`, `details[0].field` = `id` | — | — |
| `GET /api/v1/events/{id}` | id of 300 characters | `400`, `VALIDATION_ERROR` | — | — |
| `GET /api/v1/events/{id}` | unknown id `11111111-1111-4111-8111-111111111111` | `404`, `NOT_FOUND` | — | — |
| `GET /api/v1/events/{id}` | nil id `00000000-0000-0000-0000-000000000000` (boundary) | `404`, `NOT_FOUND` | — | — |
| `GET /api/v1/events` (curl) | route that does not exist yet | `404`, `NOT_FOUND`, `ErrorResponse` shape | — | — |
| `GET /api/v2/events/{id}` (curl) | unknown API version | `404`, `NOT_FOUND`, `ErrorResponse` shape | — | — |

**Rows to add when the endpoint exists:**

- list endpoint: `limit=20` → `200` with at most 20 items; `limit=21` → `400`; `limit=abc` → `400`
- `POST`: valid body → `201`; empty body, missing required field, wrong type, unknown extra field → `400`; body that is not valid JSON → `400`, `INVALID_JSON`
- `PATCH`: valid partial body → `200`; invalid value → `400`
- `DELETE`: existing id → `204`; unknown id → `404`

**Result:** — of — rows pass; — responses were `5xx` (QA-REL-01 requires zero). Defects found are filed as issues and linked here.

## AI Usage Note

This document was developed collaboratively by Oleg and Claude. Oleg provided the initial ideas and a draft, while Claude helped formalize and structure the content and produce a clear, high-quality English version.

Some numerical values marked (proposed) and some scenarios were formulated with the assistance of AI based on Oleg’s initial ideas.
