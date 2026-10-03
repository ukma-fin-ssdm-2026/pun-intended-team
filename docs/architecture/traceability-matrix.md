# Traceability Matrix — Nearby

Purpose: to show the correspondence between requirements (FR + NFR) and architecture components.
Each row reads requirement → component → design decision → verification method.
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

The *Design decision* column says how the architecture realizes the requirement and where the decision is recorded. The *Verification method* column gives the functional test (user story acceptance criteria where one exists) and, after "NFR checks", the non-functional requirements verified together with it, using the methods in §2. The full test strategy per FR is in [`rtm.md`](../requirements/rtm.md).

| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| FR-001 | CMP-01, CMP-02, CMP-04, EXT-03, EXT-04 | Sign-up/sign-in UI on the client; identity module issues/verifies codes and JWTs and verifies Google ID tokens; Account/AuthMethod persisted in CMP-04; codes dispatched via EXT-03, Google checked against EXT-04 (see [mechanisms/authentication.md](mechanisms/authentication.md)). | Functional (no US): register a new account, sign out, come back on a later visit and sign in again. NFR checks: SAFE-001, SEC-002, SEC-004, SEC-005, SEC-007. |
| FR-002 | CMP-01, CMP-02, CMP-04 | Profile form on the client; profiles module validates and persists Profile / ProfilePhoto / Interest rows. Recorded in: [data-model.md §2](data-model.md#2-entities) (profiles), [HLD §2](high-level-design.md#2-components) (profiles module). | Functional (US-003 AC1): as a first-time user fill in all required fields and save; reopen the profile and confirm the data is stored; edit a field and confirm the change persists. NFR checks: INTC-002, INTC-003, SEC-003. |
| FR-003 | CMP-01, CMP-02, CMP-04 | Request UI + admin review UI on the client; catalog module gates event publishing on `Organization.verification_status`, stored in CMP-04. Recorded in: [authentication.md](mechanisms/authentication.md) rule 6; [data-model.md §2](data-model.md#2-entities) (Organization). | Functional (no US): request organization status; confirm the account cannot post events before verification, can afterwards (FR-009) and never appears in matching. NFR checks: SEC-002, SEC-005, SEC-007. |
| FR-004 | CMP-01 | Draft state lives only on the client (data model §4: "profile drafts kept on the client"); no server or DB round trip. Recorded in: [HLD §2](high-level-design.md#2-components) (CMP-01 holds the local draft state). | Functional (US-003 AC2): fill in part of the profile, leave the screen, return and confirm the entered values are restored. NFR checks: INTC-003. |
| FR-005 | CMP-01, CMP-02, CMP-04, EXT-03 | identity module generates/validates the code and calls `notifications.sendCode` synchronously; `VerificationCode` persisted hashed in CMP-04; delivered via EXT-03. Recorded in: [authentication.md](mechanisms/authentication.md) rule 5 (one messaging adapter; the code is generated and checked by us). | Functional (no US): register, receive a code over Telegram or SMS, enter it and confirm the account is activated; enter a wrong code and confirm it is not. NFR checks: SEC-007, SEC-008. |
| FR-006 | CMP-01, CMP-02, CMP-04 | Catalog rendered on the client; catalog module reads Event/Venue/Category from CMP-04. Recorded in: [catalog-access.md](mechanisms/catalog-access.md) (guest token, minimal responses, page size ≤ 20). | Functional (US-004 AC1): open the catalog signed out and signed in; confirm both see upcoming events with title, category, date and location. NFR checks: INTC-001, PERF-002, REL-003. |
| FR-007 | CMP-01, CMP-02, CMP-04 | Filters passed as query params from the client; catalog module applies them in the CMP-04 query. Recorded in: [catalog-access.md](mechanisms/catalog-access.md); [HLD](high-level-design.md) I1 (`/events`, `/categories`). | Functional (US-004 AC2): filter by category, date or location and confirm only matching events are shown; filter with no matches and confirm the empty state; confirm a category added under FR-029 appears in the filter. NFR checks: PERF-001. |
| FR-008 | CMP-03, CMP-04, EXT-01 | Import service pulls from EXT-01 via a provider adapter (I5) and writes normalized Event/Venue rows into CMP-04 through its own DB role; catalog (CMP-02) only *reads* this data, under FR-006, so it's left out here despite the module table's `FR-006–FR-013` range nominally covering FR-008. Recorded in: [ADR-001](decisions/ADR-001.md), [ADR-003](decisions/ADR-003.md), [HLD](high-level-design.md) I5 (provider adapters). | Functional (no US): run an import cycle from a stub provider and confirm its events appear in the catalog next to organization posts. NFR checks: FLEX-003, REL-003. |
| FR-009 | CMP-01, CMP-02, CMP-04 | Organization event-creation form on the client; catalog module validates and persists the event. Recorded in: [HLD §2](high-level-design.md#2-components) (catalog module); [data-model.md §2](data-model.md#2-entities) (Event, Venue). | Functional (US-001 AC1): as an organization fill in all event fields and submit; confirm the event is published and found by filtering on its category, date and location. |
| FR-010 | CMP-01, CMP-02 | Server-side validation in the catalog module; the client only renders the returned field error — no independent DB write beyond FR-009's own attempt. Recorded in: [HLD §1](high-level-design.md#1-architectural-style) (trust boundary at the API, every rule enforced server-side). | Functional (US-001 AC2): submit the event form with each required field empty in turn; confirm the event is not published and the message points at the missing field. NFR checks: INTC-003. |
| FR-011 | CMP-01, CMP-02, CMP-04, EXT-02 | catalog module updates the Event row and enqueues `event.changed`; per I3, matching — not notifications — consumes that job, closing the pool and voiding pending matches, and it is matching that then calls notifications, which delivers to applicants via EXT-02 and the client inbox. Recorded in: [HLD](high-level-design.md) I3 (`event.changed`); [ADR-002](decisions/ADR-002.md) (job queue inside PostgreSQL). | Functional (US-002 AC1): as the creating organization edit the details and cancel an event; confirm the catalog shows both changes, users who picked the event are notified and an event whose date has passed cannot be edited. NFR checks: INTC-003. |
| FR-012 | CMP-01, CMP-02, CMP-04 | Map rendered on the client; catalog module serves Venue coordinates (PostGIS) from CMP-04. Recorded in: [ADR-002](decisions/ADR-002.md) (PostGIS for geo queries). | Functional (US-007 AC1, AC3): open the map with location access granted (centred on the user) and denied (default city view); confirm the pins for venues with upcoming events. NFR checks: PERF-001. |
| FR-013 | CMP-01, CMP-02, CMP-04 | Same module as FR-012; tap-through to the venue's event list and selection. Recorded in: [ADR-002](decisions/ADR-002.md) (PostGIS); [HLD §2](high-level-design.md#2-components) (catalog module). | Functional (US-007 AC2): tap a venue pin; confirm the venue's upcoming events are listed and one of them can be selected. NFR checks: PERF-001. |
| FR-014 | CMP-01, CMP-02, CMP-03, CMP-04 | Import service (CMP-03) writes `ImportRun` status to CMP-04; catalog module (CMP-02) reads the last successful run and serves the notice, rendered on the client. Recorded in: [HLD](high-level-design.md) I4 (shared tables); [data-model.md §2](data-model.md#2-entities) (ImportRun). | Functional (no US): make an import run fail; confirm the catalog keeps serving the last successful import with a "last updated …" notice. NFR checks: REL-003. |
| FR-015 | CMP-03, CMP-04 | Adapter skips and logs unmappable records into `SkippedRecord` (CMP-04); no client or main-server involvement. Recorded in: [data-model.md §2](data-model.md#2-entities) (SkippedRecord); [HLD](high-level-design.md) I5. | Functional (no US): feed the importer a record that cannot be mapped; confirm it is skipped and logged and the remaining records are imported. NFR checks: FLEX-003. |
| FR-016 | CMP-01, CMP-02, CMP-04 | Client selects an event; matching module writes the `Application` row (CMP-04). Recorded in: [matching.md](mechanisms/matching.md) rule 9 (event sessions). | Functional (US-009 AC1 precondition, US-007 AC2): select an event from the catalog and from a map pin; confirm the user is in that event's matching pool. NFR checks: INTC-001. |
| FR-017 | CMP-02, CMP-04 | Ranking and round logic entirely server-side, in a worker thread (ADR-001); pool data in CMP-04 (see [mechanisms/matching.md](mechanisms/matching.md)). Recorded in: [matching.md](mechanisms/matching.md) rules 1–3, 8 (instant match, rounds, open mode, pure `match()` function). | Functional (US-009 AC1): two test accounts select the same event; confirm each is matched with the participant sharing the most interests. NFR checks: FUNC-001, FUNC-002, PERF-003. |
| FR-018 | CMP-01, CMP-02, CMP-04, EXT-02 | matching module determines the state and offers the three follow-ups on the client; notifications sends "no match found" via EXT-02 and an inbox row in CMP-04. Recorded in: [matching.md](mechanisms/matching.md) rules 2–3; [notifications.md](mechanisms/notifications.md) (catalogue: "No match found"). | Functional (US-009 AC4): a single account selects an event; confirm the "no match currently available" message without an error, showing the next round time and offering all three follow-ups. NFR checks: PERF-003. |
| FR-019 | CMP-02, CMP-04 | Mutual-acceptance check enforced entirely server-side in the matching module (SEC-001), which pulls the phone number from identity and linked accounts from profiles (module dependencies, §2.2) to build the reveal; state in CMP-04. Recorded in: [HLD §5](high-level-design.md#5-architectural-invariants) (reveal enforced in CMP-02 only); [data-model.md §4](data-model.md#4-personal-and-sensitive-data). | Functional (US-009 AC1–AC3): a proposed match shows no contact details; contacts are released to both only after both approve; a decline by either side releases none. NFR checks: SAFE-002, SEC-001, SEC-003, SEC-004, INTC-003. |
| FR-020 | CMP-02, CMP-04 | matching module calls `moderation.exclusionsFor()` for reported/banned users, and separately reads its own `Exclusion` rows in CMP-04 for declined/expired proposals — two distinct sources (data model §2, matching). Recorded in: [matching.md](mechanisms/matching.md) rules 5–6 (decline and expiry exclusions). | Functional (US-009): build a candidate set with the user, a banned account, a reported user, a declined candidate and an expired-proposal candidate; confirm none is offered for this event, the declined one can be offered for a different event, and an empty set gives the FR-018 outcome. NFR checks: FUNC-002. |
| FR-021 | CMP-01, CMP-02, CMP-04 | Listing form on the client; listings module validates and persists the `Listing` row. Recorded in: [HLD §2](high-level-design.md#2-components) (listings module); [data-model.md §2](data-model.md#2-entities) (Listing). | Functional (US-010 AC1, AC2): publish a listing and confirm another user sees it; repeat with a required field empty and confirm it is not published and the message names the field. NFR checks: INTC-003. |
| FR-022 | CMP-01, CMP-02, CMP-04 | Same module, read path. Recorded in: [HLD §2](high-level-design.md#2-components) (listings module). | Functional (US-010 AC1): as a second user open the listings section and confirm a published listing is visible. NFR checks: PERF-001. |
| FR-023 | CMP-01, CMP-02, CMP-04, EXT-02 | matching module calls `notifications.notify()` in the same transaction as the proposal; it writes the inbox row (CMP-04) and enqueues push delivery via EXT-02; the client shows it. Recorded in: [notifications.md](mechanisms/notifications.md) rule 1 (inbox row written in the same transaction). | Functional (US-009 AC5): create a match between two test accounts; confirm each receives a new-match notification. |
| FR-024 | CMP-01, CMP-02, CMP-04, EXT-02 | Scheduled job inside CMP-02 (pg-boss, CMP-04) triggers notifications; delivered via EXT-02, shown in the client inbox. Recorded in: [notifications.md](mechanisms/notifications.md) (catalogue: event reminder); [HLD](high-level-design.md) I3 (`notifications.deliver`). | Functional (no US): select an event; confirm a reminder notification arrives 3 hours before it starts. |
| FR-025 | CMP-01, CMP-02, CMP-04 | Report form on the client; moderation module persists `Report` / `ReportCase`. Recorded in: [data-model.md §2](data-model.md#2-entities) (ReportCase, Report). | Functional (US-008 AC1): report another user's profile with a reason; confirm the report is saved, appears in the moderation queue and the reporter sees a confirmation. NFR checks: SAFE-003, SEC-004. |
| FR-026 | CMP-02, CMP-04 | moderation module groups repeated reports into a single `ReportCase`, server-side. Recorded in: [data-model.md §2](data-model.md#2-entities) (at most one open ReportCase per target). | Functional (US-008 AC2): report the same profile twice; confirm one case in the admin queue with the full history and a report count of 2. NFR checks: SAFE-003. |
| FR-027 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; moderation calls identity to set `Account.status = banned` and revoke sessions, rather than writing the Account table itself (§2.2: a module never writes another module's tables). Recorded in: [HLD](high-level-design.md) I3 (`user.banned`); [data-model.md §2](data-model.md#2-entities) (RefreshToken: a ban takes effect on the next request). | Functional (US-005 AC1): as administrator ban a reported user; confirm the account is disabled and the user can no longer sign in or open protected pages. NFR checks: INTC-003, SEC-001, SEC-004, SEC-005. |
| FR-028 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; moderation module calls listings to remove the `Listing` row. Recorded in: [HLD §2](high-level-design.md#2-components) (module dependencies: moderation → listings). | Functional (US-006 AC1): report a test listing, then delete it as administrator; confirm it no longer appears in the listings section. NFR checks: INTC-003, SEC-004. |
| FR-029 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; catalog module writes `Category` rows, read immediately by catalog filters. Recorded in: [data-model.md §2](data-model.md#2-entities) (Category `is_active`). | Functional (no US): as administrator add, rename and remove a category; confirm the catalog filters reflect the change immediately with no deployment. NFR checks: SEC-004. |
| FR-030 | CMP-01, CMP-02, CMP-04 | Admin UI on the client; admin module aggregates `stats()` from every other module over CMP-04. Recorded in: [HLD §2](high-level-design.md#2-components) (admin module). | Functional (no US): compare the user, event, match and open-report counts with the database; confirm a non-administrator is refused. NFR checks: PERF-001, SEC-004. |
| FR-031 | CMP-01, CMP-02, CMP-04 | Client action; matching module sets `Application.status = withdrawn` in CMP-04. Recorded in: [data-model.md §2](data-model.md#2-entities) (Application status `withdrawn`). | Functional (US-009 AC6): select an event and withdraw before a match; confirm the user is removed from that event's pool and not offered to others. |
| FR-032 | CMP-01, CMP-02, CMP-04 | Notice rendered on the client; profiles module records `safety_notice_ack_at`, gating the FR-019 contact reveal. Recorded in: [data-model.md §2](data-model.md#2-entities) (Profile `safety_notice_ack_at`). | Functional (no US): on a fresh account's first match confirm the notice appears with an acknowledgment control and stays reachable from the profile. NFR checks: SAFE-002. |
| FR-033 | CMP-01 | Purely client-side device/browser check; no server round trip. Recorded in: [HLD §2](high-level-design.md#2-components) (CMP-01). | Functional (no US): open the app on a device or browser outside the supported set; confirm the unsupported-version notice replaces normal loading. NFR checks: COMP-001. |

## 2. Non-Functional Requirements ↔ Components

Verification methods are the *Verification* fields of [`requirements.md` §4](../requirements/requirements.md#4-non-functional-requirements-nfr), shortened.

### 2.1 Performance Efficiency
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| PERF-001 | CMP-02, CMP-04 | Applies to every read endpoint server-side and its CMP-04 query; verified with k6 against staging. Recorded in: [HLD §5](high-level-design.md#5-architectural-invariants) (rounds run in a worker thread); [catalog-access.md](mechanisms/catalog-access.md) rule 2 (page size ≤ 20). | k6 scenario against staging at 500 concurrent sessions for 10 minutes, run in CI before the final demo. |
| PERF-002 | CMP-01, CMP-02, CMP-04 | Client render time + catalog module + DB read latency together decide the LCP budget. Recorded in: [catalog-access.md](mechanisms/catalog-access.md) rules 1–2 (minimal responses, ≤ 20 items per page). | Largest Contentful Paint of the catalog route, recorded by a Lighthouse / Expo trace under the PERF-001 scenario at 100 concurrent users. |
| PERF-003 | CMP-02, CMP-04 | Matching module's worker-thread round algorithm and its CMP-04 reads/writes. Recorded in: [ADR-001](decisions/ADR-001.md) (round algorithm in a worker thread); [matching.md](mechanisms/matching.md) rule 8. | load scenario with 50 virtual users requesting a match on one event inside a ten-second window; assert the p90 of request-to-answer time. |
| PERF-004 | CMP-01 | Purely client-side (Expo / React Native performance on a mid-range device). Recorded in: [HLD §2](high-level-design.md#2-components) (CMP-01). | Expo / React Native performance monitor on a physical mid-range Android device, on the catalog, profile and matching screens. |

### 2.2 Reliability
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| REL-001 | CMP-02, CMP-04 | Main server and database availability; polled on CMP-02's `/health`. Recorded in: [ADR-001](decisions/ADR-001.md) (scale-out trigger); [HLD §6](high-level-design.md#6-deployment). | external uptime monitor polling `/health` every 5 minutes. |
| REL-002 | CMP-01 | The four network states — loading, empty, error, success — and the error state's Retry action are a client-side concern. Recorded in: [HLD §2](high-level-design.md#2-components) (CMP-01). | manual pass with the network offline and throttled to 3G on every screen, plus automated tests that mock a 500 response and assert the error state renders. |
| REL-003 | CMP-02, CMP-03, CMP-04 | Catalog module (CMP-02) keeps serving CMP-04's last-imported data while the import service (CMP-03) can't reach EXT-01 — the two processes never call each other (ADR-001), so the outage stays inside CMP-03 and never reaches CMP-02's request path. Recorded in: [ADR-001](decisions/ADR-001.md) (the two processes never call each other); [HLD §4](high-level-design.md) rule 3. | integration test with the provider adapter stubbed to fail, asserting a 200 response. |
| REL-004 | CMP-04 | Managed PostgreSQL backup/retention; no app-level component involved. Recorded in: [ADR-002](decisions/ADR-002.md) (managed backups, point-in-time restore); [HLD §6](high-level-design.md#6-deployment). | confirm the retention setting on the managed Postgres host; one restore drill into a scratch database, with date and outcome recorded in the repo. |

### 2.3 Security
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| SEC-001 | CMP-02, CMP-04 | Mutual-acceptance rule checked exclusively server-side, by reading `Match.status` from CMP-04 before any reveal — an architectural invariant, unbypassable via direct API calls. Recorded in: [HLD §1](high-level-design.md#1-architectural-style), [HLD §5](high-level-design.md#5-architectural-invariants); [threat-model.md](threat-model.md) TM-06. | authorization tests over each match state (proposed, one-sided accept, mutual accept, rejected) and as an unauthenticated and a banned user; TLS configuration checked with an SSL scanner. |
| SEC-002 | CMP-02, CMP-04 | identity module hashes with argon2id; the hash lives in `AuthMethod` (CMP-04). Recorded in: [authentication.md](mechanisms/authentication.md) rule 3. | inspect the users table for the hash format; test that scans every API response schema and the captured log output for password fields. |
| SEC-003 | CMP-02, CMP-04 | Column-level encryption applied by identity/profiles before writing to CMP-04, keys from the main server's env file (ADR-002). Recorded in: [ADR-002](decisions/ADR-002.md) (column-level encryption); [data-model.md §4](data-model.md#4-personal-and-sensitive-data); [database-access.md](mechanisms/database-access.md). | read raw column values from a database dump and confirm they are unreadable; GitHub secret scanning plus a secret scan on every push in CI. |
| SEC-004 | CMP-02, CMP-04 | Each module performing a loggable action (sign-in, contact reveal, report, ban, admin action) enqueues `audit.record`; moderation writes the resulting `AuditLog` rows to CMP-04. Recorded in: [HLD](high-level-design.md) I3 (`audit.record`); [data-model.md §2](data-model.md#2-entities) (AuditLog). | test that performs each listed action and asserts a matching log record; scan of sample log output for forbidden fields. |
| SEC-005 | CMP-01, CMP-02, CMP-04 | Client stores tokens; identity module issues/validates/revokes; `RefreshToken` table in CMP-04. Recorded in: [authentication.md](mechanisms/authentication.md) rule 4; [data-model.md §2](data-model.md#2-entities) (RefreshToken). | auth test suite covering the four bad-token cases; test that bans an account mid-session and asserts the next request is rejected. |
| SEC-006 | CMP-01, CMP-02, CMP-03 | Cross-cutting engineering practice (ASVS checklist, `npm audit` CI gate) — applies to every codebase, not one runtime component. | ASVS L1 checklist reviewed and signed off in the repo; `npm audit --audit-level=high` as a CI gate. |
| SEC-007 | CMP-02 | Sign-in lockout and public-endpoint caps enforced in the identity module; the per-IP backstop sits at the load balancer (no CMP ID, deployment §6). Recorded in: [catalog-access.md](mechanisms/catalog-access.md) rule 4; [authentication.md](mechanisms/authentication.md) rule 3. | test firing six bad sign-ins and asserting the lockout; tests exceeding the per-token cap and the per-IP backstop and asserting `429`; message wording reviewed for account enumeration. |
| SEC-008 | CMP-02, CMP-04, EXT-03 | identity module enforces expiry/attempts/resend; `VerificationCode` row in CMP-04; dispatched via EXT-03. Recorded in: [authentication.md](mechanisms/authentication.md) rule 5. | tests for expiry, reuse, attempt limit and resend throttle; p95 dispatch latency measured from our own logs. |

### 2.4 Interaction Capability
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| INTC-001 | CMP-01 | First-impression usability is purely client UX, over data already served by FR-006. | moderated first-impression test with five people outside the team, recording success and wording per participant. |
| INTC-002 | CMP-01, CMP-02 | Client form + profiles module's required-field count. | timed task in the INTC-001 usability session; field count checked against the profile schema. |
| INTC-003 | CMP-01 | Confirmation dialogs and form-state preservation are client-side; the server only supplies the validation errors already covered by the relevant FRs. | UI tests submitting each form with one invalid field and asserting the other values survive; manual checklist over every irreversible action in the build. |
| INTC-004 | CMP-01, CMP-02 | Main server returns structured, non-technical error payloads (SEC-004 keeps stack traces out); client renders them in plain language. | review of the error-message catalogue before release, plus a test asserting that an unhandled server error renders the generic state rather than the exception text. |

### 2.5 Maintainability
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| MAIN-001 | CMP-02 | Coverage target applies to the NestJS API — matching service, auth guards, report/ban flow. Recorded in: [matching.md](mechanisms/matching.md) rule 8 (pure function with no I/O). | coverage report produced by the test job on every pull request; the threshold is a failing gate in the test runner. |

### 2.6 Flexibility
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| FLEX-001 | CMP-01 | Shared Expo / React Native codebase and responsive layout, client-only. | line-count script over the source tree, reported in the README; responsive check at 320, 768 and 1920 px. |
| FLEX-002 | CMP-02, CMP-04 | Main server holds no in-memory state (CMP-02's stateless design, `high-level-design.md` §2 and §5); shared state lives in CMP-04 so instances are interchangeable. Recorded in: [HLD §5](high-level-design.md#5-architectural-invariants) (no in-memory state); [ADR-001](decisions/ADR-001.md) (scale-out trigger). | when scaling, run two API containers behind a round-robin proxy and execute the integration suite against the proxy. |
| FLEX-003 | CMP-03, EXT-01 | `EventProvider` adapter interface isolates provider-specific code (I5); adding a provider touches only its adapter. Recorded in: [HLD](high-level-design.md) I5 (adapters). | write a second stub adapter and confirm the catalog serves it with no changes outside the adapter directory. |

### 2.7 Compatibility
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| COMP-001 | CMP-01 | Device/browser support matrix is client-only; unsupported cases fall to FR-033. | manual smoke pass of the core flows on one device or browser per listed target before the final demo. |

### 2.8 Functional Suitability
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| FUNC-001 | CMP-02 | Pure `match()` function in the matching module, no I/O — reproducible by construction. Recorded in: [matching.md](mechanisms/matching.md) rule 8. | unit test over a seeded fixture asserting identical output across runs; second test with two seeds asserting the orderings differ. |
| FUNC-002 | CMP-02, CMP-04 | Per-session advisory lock (CMP-04) taken by the matching module before reading the pool (high-level design §5 invariant). Recorded in: [matching.md](mechanisms/matching.md) rule 7; [HLD §5](high-level-design.md#5-architectural-invariants) (per-session advisory lock). | property test over randomly generated rounds asserting the result is a valid matching; concurrency test firing overlapping requests that all rank the same candidate first, asserting exactly one of them receives that candidate. |

### 2.9 Safety
| Requirement | Component | Design decision | Verification method |
|---|---|---|---|
| SAFE-001 | CMP-01, CMP-02, CMP-04 | Date of birth captured on the client; identity module computes age server-side and sets `Account.status`; stored encrypted in CMP-04. Recorded in: [authentication.md](mechanisms/authentication.md) (flows: date of birth, `pending` status); [data-model.md §2](data-model.md#2-entities) (Account). | boundary tests one day under, exactly on and one day over the threshold, executed against the API rather than the form. |
| SAFE-002 | CMP-01, CMP-02, CMP-04 | Notice shown on the client; profiles module records the acknowledgment, and matching checks it through profiles' service before revealing contacts (module dependencies, §2.2), never reading the Profile table itself; flag stored in CMP-04. Recorded in: [data-model.md §2](data-model.md#2-entities) (Profile `safety_notice_ack_at`). | UI test on a freshly created account, plus an API call attempting a contact reveal before acknowledgment. |
| SAFE-003 | CMP-01, CMP-02, CMP-04 | Report entry point on every profile/listing/match screen (client); moderation writes to the moderation queue (CMP-04) within the time bound. Recorded in: [data-model.md §2](data-model.md#2-entities) (ReportCase, Report); [notifications.md](mechanisms/notifications.md) (catalogue: "Report received"). | tap-count check on each of the three screens, plus an end-to-end test from submission to the report appearing in the admin queue. |

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
| Response measure | 100% of such requests return `404`, as if the match did not exist; authorization tests cover every match state (proposed, one-sided accept, mutual, declined) and banned callers, and calls without a valid access token return `401` (SEC-001; threat model TM-06) |

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
- Every requirement row has a design decision and a verification method. FR methods follow [`rtm.md`](../requirements/rtm.md); NFR methods follow the *Verification* fields of [`requirements.md` §4](../requirements/requirements.md#4-non-functional-requirements-nfr).
- Scope is deliberately narrower than the full stack wherever a requirement genuinely doesn't touch every layer, rather than defaulting every row to CMP-01+CMP-02+CMP-04: client-only (FR-004, FR-033, PERF-004, REL-002, INTC-001, INTC-003, FLEX-001, COMP-001), client + server with no independent DB write (FR-010, INTC-002, INTC-004), server-only with no DB (SEC-007, FUNC-001, MAIN-001), and database-only (REL-004).

## AI Usage Note

The ideas, architectural decisions, proposed mappings, and corrections in this document were developed and proposed by Oleh Moshenskyi. Claude was used as an assisting tool to formalize and structure these ideas, consolidate the proposed changes into a coherent document, prepare alternative formulations where appropriate, and provide a clear and consistent English version. Claude also assisted in organizing the requirements-to-component mappings and quality attribute scenarios based on Oleh Moshenskyi's proposals and architectural decisions. The resulting document was personally reviewed, verified, and approved by Oleh Moshenskyi.

After the Lab 3 review, Claude also helped make the corrections: it drafted the *Design decision* and *Verification method* columns from the existing comments, `rtm.md` and `requirements.md` §4, so that the matrix reads requirement → component → design decision → verification method. The existing comments were kept unchanged; the references to where each decision is recorded and the verification methods were added next to them.
