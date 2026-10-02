# Traceability Matrix — Nearby

Purpose: to show the correspondence between requirements (FR + NFR) and architecture components.
Verification rule: no requirement without a component, no component without a requirement.

**Legend** (component IDs match [`high-level-design.md` §2](high-level-design.md#2-components)
exactly — Nearby has one main server process for all core modules, including notifications,
plus a separate import service (ADR-001)):

| ID | Component |
|---|---|
| CMP-01 | Client (Expo — iOS / Android / web) |
| CMP-02 | Main server (NestJS) — identity, profiles, catalog, matching, notifications, moderation, listings, admin |
| CMP-03 | Event import service (NestJS) |
| CMP-04 | PostgreSQL |
| EXT-01 | External event providers (Concert.ua, ArtWizard) |
| EXT-02 | Expo Push |
| EXT-03 | Telegram Gateway API / SMS provider (fallback) |
| EXT-04 | Google (sign-in) |

## 1. Functional Requirements ↔ Components

| Requirement | Component | Comment |
|---|---|---|
| FR-001 | CMP-01, CMP-02, CMP-04, EXT-03, EXT-04 | Sign-up/sign-in UI on the client; identity module issues/verifies codes and JWTs and verifies Google ID tokens; Account/AuthMethod persisted in CMP-04; codes dispatched via EXT-03, Google checked against EXT-04 (see [mechanisms/authentication.md](mechanisms/authentication.md)). |
| FR-002 | CMP-01, CMP-02, CMP-04 | Profile form on the client; profiles module validates and persists Profile / ProfilePhoto / Interest rows. |
| FR-003 | CMP-01, CMP-02, CMP-04 | Request UI + admin review UI on the client; catalog module gates event publishing on `Organization.verification_status`, stored in CMP-04. |
| FR-004 | CMP-01 | Draft state lives only on the client (data model §4: "profile drafts kept on the client"); no server or DB round trip. |
| FR-005 | CMP-01, CMP-02, CMP-04, EXT-03 | identity module generates/validates the code and calls `notifications.sendCode` synchronously; `VerificationCode` persisted hashed in CMP-04; delivered via EXT-03. |
| FR-006 | CMP-01, CMP-02, CMP-04 | Catalog rendered on the client; catalog module reads Event/Venue/Category from CMP-04. |
| FR-007 | CMP-01, CMP-02, CMP-04 | Filters passed as query params from the client; catalog module applies them in the CMP-04 query. |
| FR-008 | CMP-03, CMP-04, EXT-01 | Import service pulls from EXT-01 via a provider adapter (I5) and writes normalized Event/Venue rows into CMP-04 through its own DB role; catalog (CMP-02) only *reads* this data, under FR-006, so it's left out here despite the module table's `FR-006–FR-013` range nominally covering FR-008. |
| FR-009 | CMP-01, CMP-02, CMP-04 | Organization event-creation form on the client; catalog module validates and persists the event. |
| FR-010 | CMP-01, CMP-02 | Server-side validation in the catalog module; the client only renders the returned field error — no independent DB write beyond FR-009's own attempt. |
| FR-011 | CMP-01, CMP-02, CMP-04, EXT-02 | catalog module updates the Event row and enqueues `event.changed`; per I3, matching — not notifications — consumes that job, closing the pool and voiding pending matches, and it is matching that then calls notifications, which delivers to applicants via EXT-02 and the client inbox. |
| FR-012 | CMP-01, CMP-02, CMP-04 | Map rendered on the client; catalog module serves Venue coordinates (PostGIS) from CMP-04. |
| FR-013 | CMP-01, CMP-02, CMP-04 | Same module as FR-012; tap-through to the venue's event list and selection. |
| FR-014 | CMP-01, CMP-02, CMP-03, CMP-04 | Import service (CMP-03) writes `ImportRun` status to CMP-04; catalog module (CMP-02) reads the last successful run and serves the notice, rendered on the client. |
| FR-015 | CMP-03, CMP-04 | Adapter skips and logs unmappable records into `SkippedRecord` (CMP-04); no client or main-server involvement. |
| FR-016 | CMP-01, CMP-02, CMP-04 | Client selects an event; matching module writes the `Application` row (CMP-04). |
| FR-017 | CMP-02, CMP-04 | Ranking and round logic entirely server-side, in a worker thread (ADR-001); pool data in CMP-04 (see [mechanisms/matching.md](mechanisms/matching.md)). |
| FR-018 | CMP-01, CMP-02, CMP-04, EXT-02 | matching module determines the state and offers the three follow-ups on the client; notifications sends "no match found" via EXT-02 and an inbox row in CMP-04. |
| FR-019 | CMP-02, CMP-04 | Mutual-acceptance check enforced entirely server-side in the matching module (SEC-001), which pulls the phone number from identity and linked accounts from profiles (module dependencies, §2.2) to build the reveal; state in CMP-04. |
| FR-020 | CMP-02, CMP-04 | matching module calls `moderation.exclusionsFor()` for reported/banned users, and separately reads its own `Exclusion` rows in CMP-04 for declined/expired proposals — two distinct sources (data model §2, matching). |
| FR-021 | CMP-01, CMP-02, CMP-04 | Listing form on the client; listings module validates and persists the `Listing` row. |
| FR-022 | CMP-01, CMP-02, CMP-04 | Same module, read path. |
| FR-023 | CMP-01, CMP-02, CMP-04, EXT-02 | matching module calls `notifications.notify()` in the same transaction as the proposal; it writes the inbox row (CMP-04) and enqueues push delivery via EXT-02; the client shows it. |
| FR-024 | CMP-01, CMP-02, CMP-04, EXT-02 | Scheduled job inside CMP-02 (pg-boss, CMP-04) triggers notifications; delivered via EXT-02, shown in the client inbox. |
| FR-025 | CMP-01, CMP-02, CMP-04 | Report form on the client; moderation module persists `Report` / `ReportCase`. |
| FR-026 | CMP-02, CMP-04 | moderation module groups repeated reports into a single `ReportCase`, server-side. |
| FR-027 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; moderation calls identity to set `Account.status = banned` and revoke sessions, rather than writing the Account table itself (§2.2: a module never writes another module's tables). |
| FR-028 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; moderation module calls listings to remove the `Listing` row. |
| FR-029 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; catalog module writes `Category` rows, read immediately by catalog filters. |
| FR-030 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; admin module aggregates `stats()` from every other module over CMP-04. |
| FR-031 | CMP-01, CMP-02, CMP-04 | Client action; matching module sets `Application.status = withdrawn` in CMP-04. |
| FR-032 | CMP-01, CMP-02, CMP-04 | Notice rendered on the client; profiles module records `safety_notice_ack_at`, gating the FR-019 contact reveal. |
| FR-033 | CMP-01 | Purely client-side device/browser check; no server round trip. |

## 2. Non-Functional Requirements ↔ Components

### 2.1 Performance Efficiency
| Requirement | Component | Comment |
|---|---|---|
| PERF-001 | CMP-02, CMP-04 | Applies to every read endpoint server-side and its CMP-04 query; verified with k6 against staging. |
| PERF-002 | CMP-01, CMP-02, CMP-04 | Client render time + catalog module + DB read latency together decide the LCP budget. |
| PERF-003 | CMP-02, CMP-04 | Matching module's worker-thread round algorithm and its CMP-04 reads/writes. |
| PERF-004 | CMP-01 | Purely client-side (Expo / React Native performance on a mid-range device). |

### 2.2 Reliability
| Requirement | Component | Comment |
|---|---|---|
| REL-001 | CMP-02, CMP-04 | Main server and database availability; polled on CMP-02's `/health`. |
| REL-002 | CMP-01 | The four network states — loading, empty, error, success — and the error state's Retry action are a client-side concern. |
| REL-003 | CMP-02, CMP-03, CMP-04 | Catalog module (CMP-02) keeps serving CMP-04's last-imported data while the import service (CMP-03) can't reach EXT-01 — the two processes never call each other (ADR-001), so the outage stays inside CMP-03 and never reaches CMP-02's request path. |
| REL-004 | CMP-04 | Managed PostgreSQL backup/retention; no app-level component involved. |

### 2.3 Security
| Requirement | Component | Comment |
|---|---|---|
| SEC-001 | CMP-02, CMP-04 | Mutual-acceptance rule checked exclusively server-side, by reading `Match.status` from CMP-04 before any reveal — an architectural invariant, unbypassable via direct API calls. |
| SEC-002 | CMP-02, CMP-04 | identity module hashes with argon2id; the hash lives in `AuthMethod` (CMP-04). |
| SEC-003 | CMP-02, CMP-04 | Column-level encryption applied by identity/profiles before writing to CMP-04, keys from the main server's env file (ADR-002). |
| SEC-004 | CMP-02, CMP-04 | Each module performing a loggable action (sign-in, contact reveal, report, ban, admin action) enqueues `audit.record`; moderation writes the resulting `AuditLog` rows to CMP-04. |
| SEC-005 | CMP-01, CMP-02, CMP-04 | Client stores tokens; identity module issues/validates/revokes; `RefreshToken` table in CMP-04. |
| SEC-006 | CMP-01, CMP-02, CMP-03 | Cross-cutting engineering practice (ASVS checklist, `npm audit` CI gate) — applies to every codebase, not one runtime component. |
| SEC-007 | CMP-02 | Sign-in lockout and public-endpoint caps enforced in the identity module; the per-IP backstop sits at the load balancer (no CMP ID, deployment §6). |
| SEC-008 | CMP-02, CMP-04, EXT-03 | identity module enforces expiry/attempts/resend; `VerificationCode` row in CMP-04; dispatched via EXT-03. |

### 2.4 Interaction Capability
| Requirement | Component | Comment |
|---|---|---|
| INTC-001 | CMP-01 | First-impression usability is purely client UX, over data already served by FR-006. |
| INTC-002 | CMP-01, CMP-02 | Client form + profiles module's required-field count. |
| INTC-003 | CMP-01 | Confirmation dialogs and form-state preservation are client-side; the server only supplies the validation errors already covered by the relevant FRs. |
| INTC-004 | CMP-01, CMP-02 | Main server returns structured, non-technical error payloads (SEC-004 keeps stack traces out); client renders them in plain language. |

### 2.5 Maintainability
| Requirement | Component | Comment |
|---|---|---|
| MAIN-001 | CMP-02 | Coverage target applies to the NestJS API — matching service, auth guards, report/ban flow. |

### 2.6 Flexibility
| Requirement | Component | Comment |
|---|---|---|
| FLEX-001 | CMP-01 | Shared Expo / React Native codebase and responsive layout, client-only. |
| FLEX-002 | CMP-02, CMP-04 | Main server holds no in-memory state (CMP-02's stateless design, `high-level-design.md` §2 and §5); shared state lives in CMP-04 so instances are interchangeable. |
| FLEX-003 | CMP-03, EXT-01 | `EventProvider` adapter interface isolates provider-specific code (I5); adding a provider touches only its adapter. |

### 2.7 Compatibility
| Requirement | Component | Comment |
|---|---|---|
| COMP-001 | CMP-01 | Device/browser support matrix is client-only; unsupported cases fall to FR-033. |

### 2.8 Functional Suitability
| Requirement | Component | Comment |
|---|---|---|
| FUNC-001 | CMP-02 | Pure `match()` function in the matching module, no I/O — reproducible by construction. |
| FUNC-002 | CMP-02, CMP-04 | Per-session advisory lock (CMP-04) taken by the matching module before reading the pool (high-level design §5 invariant). |

### 2.9 Safety
| Requirement | Component | Comment |
|---|---|---|
| SAFE-001 | CMP-01, CMP-02, CMP-04 | Date of birth captured on the client; identity module computes age server-side and sets `Account.status`; stored encrypted in CMP-04. |
| SAFE-002 | CMP-01, CMP-02, CMP-04 | Notice shown on the client; profiles module records the acknowledgment, and matching checks it through profiles' service before revealing contacts (module dependencies, §2.2), never reading the Profile table itself; flag stored in CMP-04. |
| SAFE-003 | CMP-01, CMP-02, CMP-04 | Report entry point on every profile/listing/match screen (client); moderation writes to the moderation queue (CMP-04) within the time bound. |

## 3. Quality Attribute Scenarios

Format: stimulus → source → environment → artifact → response → response measure.

### QAS-1 — Performance: peak catalog load
| Field | Value |
|---|---|
| Source of stimulus | Up to 500 concurrent users browsing the app during a peak evening period |
| Stimulus | A burst of read requests to the event catalog (`GET /events`, with filters) |
| Environment | Normal operation, peak load (A-001) |
| Artifact | CMP-02 catalog module and its CMP-04 queries |
| Response | The API serves paginated catalog results without blocking or timing out |
| Response measure | p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms (PERF-001); verified with a k6 scenario at 500 concurrent sessions for 10 minutes in CI |

### QAS-2 — Security: direct API call bypassing mutual consent
| Field | Value |
|---|---|
| Source of stimulus | An authenticated user (possibly malicious) with a valid access token |
| Stimulus | A direct call to `GET /matches/{id}` for a match that is not yet `mutual`, or for a match the caller is not a participant of, skipping the UI entirely |
| Environment | Normal operation, any match state other than mutual acceptance |
| Artifact | CMP-02 matching module and its CMP-04 query on `Match.status`, behind the `/matches` endpoint |
| Response | The server refuses the request, since the mutual-acceptance check is enforced independently of the client (SEC-001) and cannot be bypassed by calling the API directly |
| Response measure | 100% of such requests return `403`; authorization tests cover every match state (proposed, one-sided accept, mutual, declined) and unauthenticated/banned callers (SEC-001; threat model TM-06) |

### QAS-3 — Reliability: external provider outage
| Field | Value |
|---|---|
| Source of stimulus | An external event-listing provider (EXT-01) |
| Stimulus | The provider becomes unreachable or times out during a scheduled `import.run` |
| Environment | Normal operation, provider outage |
| Artifact | CMP-03 import service and the CMP-02 catalog module reading from CMP-04 |
| Response | The catalog keeps serving the last successfully imported events, marked with a "last updated …" notice; no request fails |
| Response measure | The client receives no `5xx` in 100% of such cases (REL-003); verified with an integration test that stubs the provider adapter to fail and asserts a `200` response |

## 4. Coverage Check

- Every FR (001–033) and every NFR (30 items across §4.1–4.9) has at least one component.
- Every component ID — CMP-01 … CMP-04, EXT-01 … EXT-04 — appears against at least one requirement.
- Scope is deliberately narrower than the full stack wherever a requirement genuinely doesn't touch every layer, rather than defaulting every row to CMP-01+CMP-02+CMP-04: client-only (FR-004, FR-033, PERF-004, REL-002, INTC-001, INTC-003, FLEX-001, COMP-001), client + server with no independent DB write (FR-010, INTC-002, INTC-004), server-only with no DB (SEC-007, FUNC-001, MAIN-001), and database-only (REL-004).

## AI Usage Note

The ideas, architectural decisions, proposed mappings, and corrections in this document were developed and proposed by Oleh Moshenskyi. Claude was used as an assisting tool to formalize and structure these ideas, consolidate the proposed changes into a coherent document, prepare alternative formulations where appropriate, and provide a clear and consistent English version. Claude also assisted in organizing the requirements-to-component mappings and quality attribute scenarios based on Oleh Moshenskyi's proposals and architectural decisions. The resulting document was personally reviewed, verified, and approved by Oleh Moshenskyi.
