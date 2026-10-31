# High-Level Design

## 1. Architectural Style

**Client–server with a thick server**, built as a **modular monolith** plus a **separate event import service**, over a single PostgreSQL database — see [ADR-001](decisions/ADR-001.md) and [ADR-002](decisions/ADR-002.md).

Four requirements rule out a thin server and place the trust boundary at the API rather than the UI.

- **SEC-001** — the mutual-acceptance rule is enforced server-side and "cannot be bypassed by calling the API directly"
- **SAFE-001** — age is computed server-side, "never trusted from the client"
- **SAFE-002** — contacts are withheld until an acknowledgment is recorded, including on direct API calls
- **FUNC-002** — pairing must stay exclusive and mutual under concurrent requests

Both server processes are built from **one codebase and one image**, started in different roles. Modules are split by domain; processes are split only where isolation pays off — import parses untrusted external input and may require scraping (R-001).

## 2. Components

| ID | Component | Responsibility |
|---|---|---|
| CMP-01 | Client (Expo — iOS / Android / web) | UI, local draft state (FR-004), map (FR-012), inbox polling, unsupported-version notice (FR-033). Holds no business rules. |
| CMP-02 | Main server (NestJS) | All user requests and all core background work: auth, profiles, catalog, matching, notifications, moderation, admin. Stateless: 1 instance at launch, scales horizontally (FLEX-002, verified with 2 in CI). |
| CMP-03 | Event import service (NestJS) | Periodic import from external providers (FR-008), normalization, skip-and-log (FR-015), staleness marking (FR-014, REL-003). One adapter per provider (FLEX-003). |
| CMP-04 | PostgreSQL | Single source of truth, including the job queue (ADR-002). |
| EXT-01 | External event providers | Concert.ua, ArtWizard — source for CMP-03. |
| EXT-02 | Expo Push | Push delivery for the notifications module. |
| EXT-03 | Telegram Gateway API / SMS provider | Verification codes (FR-005, SEC-008). Telegram Gateway first, SMS as fallback. Paused for now: see [authentication](mechanisms/authentication.md), rule 6. |
| EXT-04 | Google | Sign-in with Google — ID token verification only (FR-001). |

### 2.1 Main Server Modules

| Module | Responsibility | Requirements |
|---|---|---|
| identity | Registration by code, password and Google sign-in, tokens, age check | FR-001, FR-005, SEC-002, SEC-005, SEC-007, SEC-008, SAFE-001 |
| profiles | Profiles, interests, safety notice acknowledgment | FR-002, FR-004, FR-032, SAFE-002 |
| catalog | Events, sessions, venues, categories, organization verification and publishing | FR-003, FR-006–FR-013, FR-029 |
| matching | Applications, instant match, rounds, open mode, accept / decline, contact reveal | FR-016–FR-020, FR-031, FUNC-001, FUNC-002, SEC-001 |
| notifications | Inbox, push delivery, verification-code dispatch | FR-011, FR-023, FR-024 |
| moderation | Reports, cases, bans, listing removal, audit log | FR-025–FR-028, SAFE-003, SEC-004 |
| listings | "Looking for company" posts | FR-021, FR-022 |
| admin | Platform statistics | FR-030 |

Mechanism details: [matching](mechanisms/matching.md) · [notifications](mechanisms/notifications.md) · [authentication](mechanisms/authentication.md) · [catalog access](mechanisms/catalog-access.md) · [database access](mechanisms/database-access.md) · [code structure](mechanisms/code-structure.md) · [testing](mechanisms/testing.md).

### 2.2 Module Dependencies

Modules sit in three tiers, defined by dependency direction rather than importance — **Workflows** (matching, moderation, listings, admin) → **Foundation** (profiles, catalog, identity) → **Platform** (notifications). A module may depend only on modules in a lower tier or, without cycles, in its own tier. When a lower module must trigger an upper one, it publishes a job instead of calling it.

| Module | Depends on | Reacts to (job) |
|---|---|---|
| matching | profiles (interests, contacts, safety acknowledgment), catalog (sessions), identity (phone number for the contact reveal), moderation (exclusions), notifications | `event.changed`, `user.banned` |
| moderation | listings (remove), identity (revoke on ban), notifications | `audit.record` |
| admin | `stats()` of every other module | — |
| listings | catalog (event and category references), profiles (author's name) | — |
| profiles | — | — |
| catalog | — | — |
| identity | notifications (`sendCode`) | — |
| notifications | — | — |

## 3. Interfaces

### I1 — Client API (CMP-01 → CMP-02)

REST over HTTPS (TLS 1.2+), described by an **OpenAPI** spec generated from the NestJS controllers; the Expo client uses a typed client generated from it. Bearer access token (≤ 60 min) plus refresh token (≤ 30 days) (SEC-005).

| Resource group | Access | Covers |
|---|---|---|
| `/auth` | public, rate-limited | register, verify code, sign in, refresh, reset, guest token |
| `/me`, `/profiles` | user | FR-002, FR-004, FR-032 |
| `/events`, `/venues`, `/categories` | guest or user read; verified organization write (events, venues) | FR-006–FR-013 |
| `/sessions/{id}/applications` | user | FR-016, FR-031 |
| `/matches` | user, participant only | FR-017–FR-019 |
| `/listings` | user | FR-021, FR-022 |
| `/reports` | user | FR-025 |
| `/notifications` | user | inbox, polled on app open and every 30–60 s while open |
| `/admin/*` | administrator | FR-003 (organization verification), FR-026–FR-030 |

Catalog reads require a guest or user token (`/auth/guest`); responses are paginated at ≤ 20 items and cover the coming weeks only — see [catalog access](mechanisms/catalog-access.md).

### I2 — Module Interfaces (inside CMP-02)

Modules call each other only through their exported NestJS services and never read another module's tables. Examples:

- `notifications.notify(userId, type, payload, tx)` — writes the inbox row in the caller's transaction and enqueues delivery
- `notifications.sendCode(contact, code)` — synchronous, the only direct send (SEC-008)
- `moderation.exclusionsFor(userId)` — reported and banned users, for FR-020
- `catalog.getSession(sessionId)` — start time and status, for scheduling rounds

### I3 — Job Catalogue (pg-boss, in CMP-04)

A job is enqueued in the same transaction as the change that causes it. Every handler checks current state first, since delivery is at-least-once.

| Job | Producer | Consumer | Payload | When |
|---|---|---|---|---|
| `matching.round` | matching | matching | `sessionId` | delayed, at each round offset |
| `matching.cutoff` | matching | matching | `sessionId` | delayed, at the open-mode cutoff |
| `matching.expire` | matching | matching | `matchId` | delayed, at `valid_until` — expires the proposal, applies strikes |
| `notifications.deliver` | notifications | notifications | `notificationId` | immediate or delayed (reminders, "respond soon") |
| `event.changed` | CMP-03, catalog | matching | `eventId`, `change` | immediate — closes pools, voids pending matches, notifies applicants |
| `user.banned` | moderation | matching | `userId` | immediate — withdraws applications, voids pending matches |
| `audit.record` | identity and the other modules below moderation | moderation | actor, action, target, result, IP address | immediate — moderation writes the AuditLog row (SEC-004) |
| `import.run` | schedule | CMP-03 | `providerId` | cron |
| `moderation.retention` | schedule | moderation | — | daily — audit log past retention (SEC-004) |
| `identity.retention` | schedule | identity | — | daily — expired or revoked tokens, used or expired codes (SEC-005, SEC-008) |

`event.changed` is the only job crossing from CMP-03 to CMP-02: import publishes a fact, the main server decides what it means.

### I4 — Shared Tables (CMP-02, CMP-03 → CMP-04)

| Tables | Written by | Read by |
|---|---|---|
| imported `events`, `venues`, `import_runs`, skipped records | CMP-03 | CMP-02 |
| organization-created `events` and `venues` | CMP-02 | CMP-02 |
| everything else | CMP-02 | CMP-02 |

Each process connects with its own database role; the import role can write only the tables above — see [database access](mechanisms/database-access.md).

### I5 — Adapters (FLEX-003)

| Adapter | Used by | Implementations |
|---|---|---|
| `EventProvider.fetch(since)` → raw records; `normalize(raw)` → event or skip | CMP-03 | one per provider |
| `PushProvider.send(batch)` — up to 100 messages | notifications | Expo Push |
| `MessagingProvider.sendCode(contact, code)` | notifications | Telegram Gateway API → SMS fallback chain |
| `GoogleIdentity.verify(idToken)` → `{ sub, email }` | identity | Google |

## 4. How Components Communicate

1. **Clients talk only to CMP-02**, through I1.
2. **Background work goes through the job queue**, enqueued in the same transaction as the change. If a handler fails, the job is retried; nothing is lost.
3. **CMP-02 and CMP-03 never call each other.** They share only the tables in I4 and the `event.changed` job.
4. **Scheduled work needs no hand-written locks** — pg-boss runs each job once across instances.
5. **All outbound calls go through an adapter** (I5).

## 5. Architectural Invariants

- CMP-02 holds no in-memory session or request state (FLEX-002)
- The instant-match path and the round job take the same per-session advisory lock before reading the pool, so a candidate is never claimed twice (FUNC-002)
- The round algorithm runs in a worker thread and never blocks request handling (PERF-001)
- Authorization, age checks and contact reveals are enforced in CMP-02 only (SEC-001, SAFE-001, SAFE-002)
- A module never reads another module's tables, and module dependencies never form a cycle (§2.2)
- Every external integration sits behind a single adapter interface (FLEX-003)

## 6. Deployment

| Node | Runs | Instances |
|---|---|---|
| Mobile device / browser | Expo app (CMP-01) | — |
| Load balancer / reverse proxy | TLS termination, per-IP backstop limit | 1 |
| App host | Main server (CMP-02) | 1 at launch, scales horizontally |
| App host | Event import service (CMP-03) | 1 |
| Managed PostgreSQL | CMP-04 — encrypted volume, daily backups (REL-004) | 1 |
| External | EXT-01 – EXT-04 | — |

Trust boundaries sit between the internet and the load balancer, and between our network and every external system. Diagram: [deployment diagram](uml/rendered/deployment-diagram.svg) (source: [`uml/deployment-diagram.puml`](uml/deployment-diagram.puml)).

## 7. Diagrams

- [Component diagram](uml/rendered/component-diagram.svg) (source: [`uml/component-diagram.puml`](uml/component-diagram.puml)) — system-level components and their interfaces
- [Main server components](uml/rendered/main-server-components.svg) (source: [`uml/main-server-components.puml`](uml/main-server-components.puml)) — internal structure of CMP-02: layers and module tiers
- [Deployment diagram](uml/rendered/deployment-diagram.svg) (source: [`uml/deployment-diagram.puml`](uml/deployment-diagram.puml)) — nodes, trust boundaries
- [Sequence diagram](uml/rendered/sequence-diagram.svg) (source: [`uml/sequence-diagram.puml`](uml/sequence-diagram.puml)) — key interaction flow
- [Auth sequence diagram](uml/rendered/sequence-diagram-auth.svg) (source: [`uml/sequence-diagram-auth.puml`](uml/sequence-diagram-auth.puml)) — registration, sign-in, guest tokens and the token check
- [Data model (ER)](uml/rendered/data-model.svg) (source: [`uml/data-model.puml`](uml/data-model.puml)) — entities, keys, relationships

## AI Usage Note

Drafted using Claude based on meeting notes, diagrams and an architecture discussion led by Viktoriia Baran.
