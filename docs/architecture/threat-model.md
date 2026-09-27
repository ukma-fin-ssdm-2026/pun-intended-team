# Threat Model (STRIDE)

STRIDE analysis of Nearby's deployment ([high-level design §6](high-level-design.md)). Trust zones and boundaries are marked on [`uml/deployment-diagram.puml`](uml/deployment-diagram.puml); the data at stake and its sensitivity classes come from [data model §4](data-model.md).

## 1. Trust Zones and Boundaries

| Zone | Contains | Trust |
|---|---|---|
| Z0 Internet | user devices (iOS, Android, web), guests, anyone calling the API directly | untrusted |
| Z1 Edge | load balancer / reverse proxy | trusted, holds no data |
| Z2 Core | main server (CMP-02), secrets store | trusted |
| Z3 Import | event import service (CMP-03) | partly trusted — parses untrusted external input |
| Z4 Data | PostgreSQL (CMP-04), including the job queue and profile photos | trusted, reached only through database roles |
| Z5 External | event providers, Telegram Gateway API / SMS, Expo Push, Google | outside our control |

| ID | Boundary | What crosses it |
|---|---|---|
| TB1 | user device ↔ load balancer / API | every request; all input is untrusted |
| TB2 | load balancer ↔ main server | authenticated and guest requests, inside our private network |
| TB3 | main server ↔ PostgreSQL | all application data, role `nearby_main` |
| TB4 | import service ↔ PostgreSQL | imported events and venues, role `nearby_import` |
| TB5 | event providers → import service | raw event data, possibly scraped HTML |
| TB6 | main server → Telegram Gateway / SMS, Expo Push, Google | phone numbers and codes, push content, Google ID tokens |
| TB7 | main server → secrets store | JWT, column-encryption and HMAC keys |

## 2. STRIDE Walkthrough

Each component and boundary was checked against the six questions. A cell names the risk from §3 or the control that already answers the question; "—" means the question does not apply.

| Element | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| User device (Z0) | TM-01, TM-12 | the client is never trusted; every rule is enforced server-side | — | tokens kept in the device's secure storage | — | TM-11 |
| TB1 device ↔ LB | TLS 1.2+ (SEC-001) | TLS 1.2+ | — | TLS 1.2+; plain HTTP redirected | TM-08, TM-10 | — |
| Load balancer (Z1) | — | — | — | — | per-IP backstop limit | — |
| TB2 LB ↔ main server | — | — | — | TM-13 | — | — |
| Main server (Z2) | TM-01, TM-02, TM-12 | input validation | TM-05 | TM-06, TM-14 | TM-09; rounds run in a worker thread (ADR-001) | TM-11 |
| TB3 main server ↔ DB | own database role | — | — | — | — | role without schema rights (`nearby_owner` only in migrations) |
| PostgreSQL (Z4) | — | TM-03 | TM-05 | TM-07 | managed host, daily backups (REL-004) | — |
| Import service (Z3), TB4 | — | TM-03, TM-04 | — | role cannot read personal tables | — | role limited to imported events, venues, import runs and skipped records |
| TB5 providers → import | — | TM-04 | — | — | provider outage: REL-003 | — |
| TB6 main server → external | Google tokens verified server-side | TLS | provider request IDs stored | codes and push text carry no contacts | TM-08 | — |
| Expo Push → user device | push is only a hint; the app reads the inbox through the API | TLS (Expo, APNs / FCM) | — | push text carries no contacts | missed push: the inbox still has the row (notifications.md) | — |
| TB7 secrets store | — | — | — | JWT, column-encryption and HMAC keys reachable from CMP-02 only; the import service receives only its own database credentials | — | — |

## 3. Risks

**Severity.** *High* — likely, or directly harms users' safety, contacts or money; *Medium* — plausible with limited or recoverable harm; *Low* — unlikely or with minor impact.

| ID | Component / boundary | STRIDE | Scenario | Severity | Mitigation or decision |
|---|---|---|---|---|---|
| TM-01 | identity, TB6 | Spoofing | An attacker takes over the victim's phone number (SIM swap) or Telegram account, requests a password-reset code and signs in as the victim, seeing their matches' contacts. | Medium | **Accepted** at this scale. A reset revokes all sessions (SEC-005) and writes an audit record; contacts of past matches were revealed only after mutual acceptance. |
| TM-02 | catalog, organization accounts | Spoofing | Someone poses as a real venue and publishes a fake event to lure matched users to a chosen place. | Medium | **Mitigated.** An organization is a regular user account that publishes only after the team verifies it (`Organization.verification_status`); an administrator can revoke verification or ban the account; the first-match safety notice advises meeting in public (FR-032). |
| TM-03 | import service, TB4 | Tampering | A compromised import service modifies organization-created events or venues, since there is no row-level security on `source`. | Low | **Accepted** ([database access](mechanisms/database-access.md)): import can already affect catalog content through imported events. Its role cannot touch any other table or any key; each change raises `event.changed`, which leaves a trace. |
| TM-04 | TB5, import service | Tampering | A provider page contains HTML or script in a title or description; stored as-is, it runs in other users' web clients (stored XSS). | Medium | **Mitigated.** Adapters normalize every field to plain text and drop markup; the client renders text, never HTML; the web build sends a Content-Security-Policy. |
| TM-05 | moderation, PostgreSQL | Repudiation | A user denies accepting a match that revealed contacts, a reporter denies filing a report, or an administrator denies a ban. | Low | **Mitigated** by the audit log (SEC-004): actor, action, target, time and result, append-only, written in the same transaction as the action (directly by moderation or through the `audit.record` job). Editing the log with direct database access is an accepted residual risk. |
| TM-06 | main server, `/matches` | Information disclosure | A user calls the API directly to read a match's contacts before both have accepted, or reads someone else's match by changing its ID. | High | **Mitigated.** The phone number and linked accounts are released only for `mutual` matches after the safety acknowledgment, checked server-side (SEC-001, SAFE-002); only the two participants can read a match; notifications never carry contacts. Authorization tests cover every match state and non-participants. |
| TM-07 | PostgreSQL, backups | Information disclosure | A database dump or backup leaks. | Medium | **Mitigated** for the most sensitive data: phone numbers and linked-account usernames are column-encrypted with keys outside the database, lookups use an HMAC, passwords, codes and tokens are hashed (SEC-002, SEC-003). **Accepted:** the date of birth, photos, descriptions and per-event answers are protected only by volume and backup encryption. |
| TM-08 | identity, TB6 | Denial of service | Automated sign-ups request thousands of codes to numbers the attacker profits from (SMS pumping), running up the Telegram Gateway and SMS bill. | High | **Mitigated.** Codes only to Ukrainian numbers (+380, matching the Kyiv scope, C-002); per-number resend throttle (SEC-008); per-IP and per-guest-token limits on the sign-up endpoint; a daily spend cap and alert at the providers; Telegram Gateway refunds codes not delivered within their time-to-live. |
| TM-09 | identity | Denial of service | An attacker who knows a victim's phone number fires wrong passwords to keep the account locked (SEC-007). | Medium | **Accepted.** A lockout lasts 15 minutes; Google sign-in still works; per-IP limits make keeping many accounts locked costly. |
| TM-10 | TB1, catalog | Information disclosure | A scraper copies the whole catalog or floods the public endpoints. | Low | **Mitigated, residual accepted** ([catalog access](mechanisms/catalog-access.md)): guest token, pages of 20, no bulk endpoint, per-token limits with a per-IP backstop; app attestation is planned if scraping is observed. |
| TM-11 | main server | Elevation of privilege | A user calls `/admin/*`, publishes an event without a verified organization, edits another organization's event, or a pending or under-18 account uses the API before activation. | High | **Mitigated.** Deny-by-default guards check role, organization verification, ownership and `Account.status = active` on every endpoint (SAFE-001, SEC-005); tests cover the guards at ≥ 85% (MAIN-001). |
| TM-12 | identity, TB6 | Spoofing | An attacker creates a Google account with the victim's email and gets it linked to the victim's Nearby account. | Low | **Mitigated** ([authentication](mechanisms/authentication.md)): Google is linked only from a signed-in session, never by matching email; ID tokens are verified server-side. |
| TM-13 | TB2 | Information disclosure | Traffic between the load balancer and the main server, after TLS termination, is read by someone inside the hosting network. | Low | **Accepted.** Both sit in one private network of the managed host; re-encrypting internal traffic is not worth the operational cost at this scale. Revisit if the load balancer and the app host move to different providers. |
| TM-14 | main server, photo endpoint | Information disclosure | A registered account downloads other users' photos in bulk to build a scraped dataset. | Medium | **Mitigated, residual accepted.** Photos are served only through an authenticated endpoint, never as public links; per-token rate limits apply; mass access shows up in logs and the account can be banned. A signed-in user can still save the photos they are shown. |

## 4. Accepted Risks

| Risk | Why accepted | Revisit when |
|---|---|---|
| TM-01 SIM swap / Telegram takeover | stronger identity proof is out of proportion for a student-scale app | the app handles payments or grows beyond one city |
| TM-03 import tampering with organization events and venues | same exposure as imported events; row-level security fails silently | import moves to scraping of unknown sites |
| TM-07 date of birth, photos and descriptions in a leaked backup | column encryption of these fields adds cost for little extra benefit | photos move to an object store |
| TM-09 lockout abuse | short lockout, other sign-in paths remain | abuse shows up in the audit log |
| TM-13 unencrypted internal hop | single private network of one provider | the edge and the app host are split across providers |

TM-10 and TM-14 are mitigated, but their residual part — copying what a legitimate user can already see — is accepted as well.

## AI Usage Note

Drafted with Claude from the project's requirements and architecture documents and the team's review notes. Reviewed and edited by Daryna Halytska.