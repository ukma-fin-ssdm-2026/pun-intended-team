# High-Level Design

## 1. Architectural Style

**Client–server with a thick server**, split into **three back-end services over a single shared PostgreSQL database**.

Four requirements rule out a thin server and place the trust boundary at the API rather than the UI. C-004 additionally fixes the stack: Expo client, NestJS API, Prisma, PostgreSQL.

- **SEC-001** — the mutual-acceptance rule is enforced server-side and "cannot be bypassed by calling the API directly"
- **SAFE-001** — age is computed server-side, "never trusted from the client"
- **SAFE-002** — contacts are withheld until an acknowledgment is recorded, including on direct API calls
- **FUNC-002** — pairing must stay exclusive and mutual under concurrent requests

The three services are split by **responsibility**: user-facing requests and matching, event import, and outbound communication. They share one database and one schema, so this is a modular system deployed as separate processes rather than a fully independent microservice architecture — see ADR-001.

## 2. Components

| ID | Component | Responsibility |
|---|---|---|
| CMP-01 | Client (Expo — iOS / Android / web) | UI, local draft state (FR-004), map (FR-012). Holds no business rules. |
| CMP-02 | Main server (NestJS) | All user requests: auth, profiles, organizations, catalog, listings, moderation, admin. All matching: pool, rounds, ranking, accept/decline, withdrawal and proposal expiry (FR-016–FR-020, FR-031, UC-001 A4). Stateless, 2+ instances (FLEX-002). |
| CMP-03 | Notification service | All outbound communication: push notifications (FR-023, FR-024), event-change notices (FR-011) and registration verification codes (FR-005). Picks up work written by CMP-02 and delivers it through EXT-02 and EXT-03. |
| CMP-04 | Event import service | Periodic import from external providers (FR-008), normalization into our event model, skip-and-log of unmappable records (FR-015), staleness marking (FR-014, REL-003). One adapter per provider (FLEX-003). |
| CMP-05 | PostgreSQL | Single source of truth, including the outbound-message queue. |
| EXT-01 | External event providers | Concert.ua, ArtWizard — source for CMP-04. |
| EXT-02 | Expo Push | Push delivery for CMP-03. |
| EXT-03 | SMS / Telegram provider | Verification code delivery for CMP-03. |

## 3. How Components Communicate

1. **Clients talk only to CMP-02**, over TLS 1.2+ (SEC-001).
2. **Services hand work to each other through CMP-05, not over HTTP.** CMP-02 writes a match and its outbound message in one transaction; CMP-03 picks the message up and delivers it. If CMP-03 is down, nothing is lost — the row waits.
3. **CMP-03 is woken by the database, not by polling.** SEC-008 budgets a verification code at p95 ≤ 2 s from request to provider, so a poll interval of several seconds would consume the whole budget. PostgreSQL `LISTEN`/`NOTIFY` wakes the service in milliseconds.
4. **CMP-04 writes to CMP-05 directly** and never calls CMP-02, so a failing import cannot affect request latency (REL-003).
5. **Only CMP-02 and CMP-03 run scheduled work**, and each guards it with a database lock so a second instance cannot run the same sweep twice.

## 4. Architectural Invariants

- CMP-02 holds no in-memory session or request state (FLEX-002)
- The matching pool and rounds are guarded by row-level locks in CMP-05, so concurrent requests landing on different CMP-02 instances cannot both claim the same candidate (FUNC-002)
- Authorization, age checks and contact reveals are enforced in CMP-02 only (SEC-001, SAFE-001, SAFE-002)
- Every outbound integration sits behind a single adapter interface (FLEX-003)

## 5. Diagrams

- [`uml/component-diagram.puml`](uml/component-diagram.puml) — components and their interfaces

## AI Usage Note

Drafted using Claude based on meeting notes and diagrams.
