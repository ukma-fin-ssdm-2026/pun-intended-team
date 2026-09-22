
Traceability matrix nearby · MD
# Traceability Matrix — Nearby
 
Purpose: to show the correspondence between functional requirements and architecture components.
Verification rule: no requirement without a component, no component without a requirement.
Components per high-level-design.md.
 
**Legend:**
CMP-01 — Client (Expo) · CMP-02 — Main server (NestJS, incl. matching) ·
CMP-03 — Notification service · CMP-04 — Event import service · CMP-05 — PostgreSQL ·
EXT-01 — External listing services · EXT-02 — Expo Push · EXT-03 — SMS/Telegram provider
 
| Requirement | Component | Comment |
|--------|-----------|----------|
| FR-001 | CMP-01, CMP-02, CMP-05 | Form on the client; authentication and JWT issuance — on the server; the user is stored in the DB. |
| FR-002 | CMP-01, CMP-02, CMP-05 | Profile form on the client, saved via the server into the DB. |
| FR-006 | CMP-01, CMP-02, CMP-05 | Catalog is rendered on the client, data is read via the server from the DB. |
| FR-007 | CMP-01, CMP-02 | Filters — query parameters from client to server. |
| FR-008 | CMP-04, EXT-01 | Event import service periodically pulls events from external providers. |
| FR-016 | CMP-01, CMP-02, CMP-05 | Client selects an event; server adds the user to the matching pool (stored in the DB). |
| FR-017 | CMP-02, CMP-05 | All candidate-ranking logic is on the server (not in a separate worker); pool data is in the DB. |
| FR-019 | CMP-02, CMP-05 | Contact disclosure after mutual confirmation — checked and performed exclusively on the server. |
| FR-023 | CMP-02, CMP-05, CMP-03, EXT-02 | The server writes the match event and message into a single transactional outbox; the Notification service picks it up and sends it via Expo Push. |
| FR-024 | CMP-03, CMP-05, EXT-02 | The scheduled reminder task is executed by the Notification service, delivered via Expo Push. |
| FR-027 | CMP-02, CMP-05 | Banning a user — an administrator action via the server, status stored in the DB. |
| SEC-001 | CMP-02 | The mutual confirmation rule is checked exclusively on the server — an architectural invariant that cannot be bypassed by a direct API call. |
| FR-003 | | |
| FR-004 | | |
| FR-005 | | |
| FR-009 | | |
| FR-010 | | |
| FR-011 | | |
| FR-012 | | |
| FR-013 | | |
| FR-014 | | |
| FR-015 | | |
| FR-018 | | |
| FR-020 | | |
| FR-021 | | |
| FR-022 | | |
| FR-025 | | |
| FR-026 | | |
| FR-028 | | |
| FR-029 | | |
| FR-030 | | |
| FR-031 | | |
| FR-032 | | |
| FR-033 | | |
 
## Quality Attribute Scenarios
 
## AI Usage Note
Claude helped formalize the idea, structure the mapping, and prepare several possible component assignments and comments based on requirements.md and high-level-design.md. I reviewed all the proposed variants and verified the final mapping.
