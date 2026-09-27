# Data Model

Entity–relationship model of Nearby's PostgreSQL schema (CMP-04, [ADR-002](decisions/ADR-002.md)). Entities are grouped by the module that owns them ([high-level design §2.1](high-level-design.md)); a module writes only its own tables.

Diagram: [`uml/data-model.puml`](uml/data-model.puml)

## 1. Key Functions Covered

| Key function (Project-Description.md) | Entities |
|---|---|
| Registration and sign-in | Account, AuthMethod, VerificationCode, RefreshToken |
| User profile | Profile, ProfilePhoto, Interest, ProfileInterest |
| Event catalog (organization posts + import) | Organization, Category, Venue, Event, EventSession, ImportRun, SkippedRecord |
| Event-based matching | Application, Match, Exclusion |
| Contact exchange after a match | Account.contact_identifier, Profile contact fields, Match.status, Profile.safety_notice_ack_at |
| Listings | Listing |
| Notifications | Notification, DeviceToken |
| Reports and moderation | ReportCase, Report, AuditLog |

## 2. Entities

Notation: **PK** primary key, **FK** foreign key, **UK** unique. Sensitivity marks (S), (C), (P) are defined in §4. Every table also has `created_at` and, where rows change, `updated_at`; all times are `timestamptz`.

### identity

| Entity | Key | Main attributes |
|---|---|---|
| **Account** | PK `id` | `role` (user / organization / admin), `contact_identifier` (S, encrypted) — the verified phone number (E.164), revealed on a mutual match unless `Profile.share_phone` is off, `contact_hash` (UK) — HMAC of the number, used for uniqueness and lookup, `date_of_birth` (S, required for users before activation, SAFE-001), `status` (pending / active / banned), `failed_signins`, `locked_until` (SEC-007) |
| **AuthMethod** | PK `id` | `account_id` FK, `type` (password / google), `secret` — argon2id hash (C) for a password, Google `sub` (P) for Google |
| **VerificationCode** | PK `id` | `contact` (S, encrypted) — phone number, `contact_hash` — HMAC of the number, used for the resend throttle, `channel` (telegram / sms) — the channel that delivered the code, `provider_request_id` — delivery request at the provider, `code_hash` (C), `purpose` (registration / reset), `sent_at`, `expires_at`, `attempts`, `used_at` (SEC-008: resend throttle, expiry, attempt limit, single use). No FK: the code is sent before the account exists. |
| **RefreshToken** | PK `id` | `account_id` FK, `token_hash` (C), `expires_at`, `revoked_at` (SEC-005) |

### profiles

| Entity | Key | Main attributes |
|---|---|---|
| **Profile** | PK = FK `account_id` | `display_name` (P), `description` (P), `communication_format` (S), `telegram_username` (S, optional), `instagram_username` (S, optional), `share_phone` (default true), `safety_notice_ack_at` (FR-032, SAFE-002) |
| **ProfilePhoto** | PK = FK `profile_id` | `content` (S, bytea), `content_type` — kept apart from Profile so that profile reads do not load the image |
| **Interest** | PK `id` | `name` (UK) — a fixed list seeded at launch; users pick from it and never type free text |
| **ProfileInterest** | PK (`profile_id`, `interest_id`) | junction table |

### catalog

| Entity | Key | Main attributes |
|---|---|---|
| **Organization** | PK = FK `account_id` | `name`, `description`, `website` |
| **Category** | PK `id` | `name` (UK), `is_active` (FR-029) |
| **Venue** | PK `id` | `name`, `address`, `location` (PostGIS point, FR-012), `source` (organization / import), `organization_id` FK (organization venues only) |
| **Event** | PK `id` | `category_id` FK, `venue_id` FK, `organization_id` FK (null for imported), `source` (organization / import), `provider` and `external_id` (imported only, UK together — re-import updates the same row), `title`, `description`, `starts_at`, `ends_at` (FR-007 date filter; when a provider gives no end, the end of the start day in Europe/Kyiv), `status` (published / cancelled) |
| **EventSession** | PK `id` | `event_id` FK, `starts_at`, `status` (scheduled / cancelled) — matching rounds are anchored here ([matching](mechanisms/matching.md)); UK (`event_id`, `starts_at`) |

### import (CMP-03)

| Entity | Key | Main attributes |
|---|---|---|
| **ImportRun** | PK `id` | `provider`, `started_at`, `finished_at`, `status` — the last successful run gives the "last updated" notice (FR-014) |
| **SkippedRecord** | PK `id` | `import_run_id` FK, `raw` (jsonb), `reason` (FR-015) |

### matching

| Entity | Key | Main attributes |
|---|---|---|
| **Application** | PK `id` | `user_id` FK, `session_id` FK, `per_event_answers` (S, jsonb) — answers to the question set defined in the matching module, validated on write, `answers_version`, `status` (in_pool / paired / withdrawn / no_match / cancelled — the event was cancelled or the user banned), `created_at` — order in open mode |
| **Match** | PK `id` | `application_a_id` FK, `application_b_id` FK, `source` (instant / round / open), `score`, `seed` (FUNC-001), `status` (proposed / accepted_a / accepted_b / mutual / declined / expired / cancelled), `cancel_reason` (event_cancelled / participant_banned / participant_withdrew), `valid_until` — a proposal past `valid_until` is treated as expired on read; the next round, open-mode pass or cutoff job writes `expired` |
| **Exclusion** | PK `id` | `user_id` FK, `excluded_user_id` FK, `event_id` FK, `match_id` FK — one row per decline: the decliner excludes the declined |

### listings

| Entity | Key | Main attributes |
|---|---|---|
| **Listing** | PK `id` | `author_id` FK, `category_id` FK, `event_id` FK (optional), `title`, `description` (P), `date`, `status` (active / removed) |

### moderation

| Entity | Key | Main attributes |
|---|---|---|
| **ReportCase** | PK `id` | `target_type` (account / listing), `target_account_id` or `target_listing_id` FK (exactly one set), `status` (open / resolved), `resolution` (banned / removed / dismissed), `resolved_by` FK → Account (admin), `resolved_at`. At most one open case per target (FR-026). |
| **Report** | PK `id` | `case_id` FK, `reporter_id` FK, `reason`, `comment` (P) |
| **AuditLog** | PK `id` | `created_at`, `actor_id`, `action`, `target_type`, `target_id`, `result`, `ip_address` (P). Append-only; `actor_id` has no FK so records outlive accounts (SEC-004). |

### notifications

| Entity | Key | Main attributes |
|---|---|---|
| **Notification** | PK `id` | `account_id` FK, `type` (match_proposed / match_mutual / respond_soon / not_a_match / no_match_found / event_reminder / event_changed / report_received), `payload` (P, jsonb), `dedupe_key` (UK), `push_status` (pending / sent / failed / skipped), `read_at` — the row is the inbox item ([notifications](mechanisms/notifications.md)). A `match_mutual` payload never contains contact details — the client fetches them from `/matches`, where SEC-001 and SAFE-002 are enforced. Verification codes are not notifications: they go through VerificationCode and the messaging adapter. |
| **DeviceToken** | PK `id` | `account_id` FK, `refresh_token_id` FK — the session it belongs to, deleted when that session is revoked, `push_token` (P, UK), `platform` (ios / android) |

## 3. Relationships

| Relationship | Cardinality | Note |
|---|---|---|
| Account — AuthMethod | 1 : 0..* | one account, several sign-in methods |
| Account — RefreshToken | 1 : 0..* | |
| Account — Profile | 1 : 0..1 | only `role = user`; the profile shows the age computed from `Account.date_of_birth` through the identity interface |
| Account — Organization | 1 : 0..1 | only `role = organization` |
| Profile — ProfilePhoto | 1 : 0..1 | |
| Profile — Interest | M : N | via ProfileInterest |
| Organization — Event | 0..1 : 0..* | imported events have no organization |
| Category — Event, Category — Listing | 1 : 0..* | |
| Venue — Event | 1 : 0..* | |
| Organization — Venue | 0..1 : 0..* | an organization reuses its own venues; imported venues have no organization |
| Event — EventSession | 1 : 0..* | none until someone applies; then one for a single-day event, one per applied day for a multi-day event (§5) |
| ImportRun — SkippedRecord | 1 : 0..* | |
| Account — Application | 1 : 0..* | at most one active application per user and session |
| EventSession — Application | 1 : 0..* | the session's pool |
| Application — Match | 1 : 0..* (as A or B) | each Match joins exactly two applications; an application has at most one open match at a time (FUNC-002) |
| Match — Exclusion | 1 : 0..1 | a row only when the match was declined |
| Event — Exclusion | 1 : 0..* | an exclusion is scoped to one event |
| Account — Listing | 1 : 0..* | |
| Event — Listing | 0..1 : 0..* | a listing may point at a catalog event |
| ReportCase — Report | 1 : 1..* | repeat reports grouped into one case (FR-026) |
| Account — Report | 1 : 0..* | reporter |
| ReportCase — target | 0..1 Account or 0..1 Listing | |
| Account — Notification, Account — DeviceToken | 1 : 0..* | |
| RefreshToken — DeviceToken | 1 : 0..1 | no push after sign-out |

### Invariants and How They Are Enforced

| Invariant | Enforced by |
|---|---|
| One active application per user and session | partial unique index on (`user_id`, `session_id`) where `status` in (in_pool, paired) |
| One open case per report target | partial unique index on the target where `status = open` |
| Exactly one target in a ReportCase | CHECK |
| At least one shared contact | CHECK on Profile (`share_phone` or a username is set) |
| A Match joins two different applications | CHECK (`application_a_id <> application_b_id`) |
| Both applications of a Match belong to the same session | service (matching), under the per-session lock |
| Profile and Application only for `role = user` | service — the role lives in another module |

## 4. Personal and Sensitive Data

This table is the starting point for the [threat model](threat-model.md).

- **(C) Credential** — never returned by the API, never logged; stored only as a hash.
- **(S) Sensitive personal** — exposure harms the user directly (contact, age, dating intent, face); access is restricted and encrypted at rest.
- **(P) Personal** — identifies or describes a person but is visible to other users by design, or is technical data tied to a person.

| Data | Where | Class | Protection |
|---|---|---|---|
| Password hash | AuthMethod.secret | C | argon2id (SEC-002) |
| Verification code, refresh token | VerificationCode.code_hash, RefreshToken.token_hash | C | stored hashed; expiry and revocation (SEC-005, SEC-008) |
| Phone number, Telegram and Instagram usernames | Account.contact_identifier, VerificationCode.contact, Profile.telegram_username, Profile.instagram_username | S | column-level encryption (SEC-003), looked up only through `contact_hash`; Account and Profile contacts are revealed only after mutual acceptance and safety acknowledgment (SEC-001, SAFE-002); VerificationCode.contact is never revealed |
| Date of birth | Account.date_of_birth | S | encrypted at rest (SEC-003); clients receive only the age |
| Photo | ProfilePhoto.content | S | encrypted at rest with the database volume; served only through an authenticated API endpoint, never as a public link |
| Communication format, per-event answers | Profile.communication_format, Application.per_event_answers | S | reveal a "dating" preference; shown only to a proposed match |
| Google subject ID | AuthMethod.secret (type google) | P | never returned by the API |
| Display name, description, interests | Profile, ProfileInterest | P | shown to other signed-in users by design, never to guests. The description is free text and may contain whatever the user chooses to disclose; reports (FR-025) cover misuse. |
| Listing text, report comment | Listing.description, Report.comment | P | report comments visible to administrators only |
| Notification content | Notification.payload | P | owner only |
| Push token | DeviceToken.push_token | P | never returned by the API |
| IP address | AuditLog.ip_address | P | audit log retention (SEC-004, OQ-002) |

**Not stored:** the user's location (the map centres on the device, FR-012), profile drafts (kept on the client, FR-004) and guest tokens (signed, verified without a lookup). Rate-limit counters are short-lived and kept at the load balancer, keyed on the token as well as the IP ([catalog access](mechanisms/catalog-access.md), ADR-002); account lockout is the only limit stored here.

## 5. Design Decisions

- **One Account table with a role.** Users, organizations and administrators share Account, AuthMethod and RefreshToken; role-specific data lives in Profile and Organization. Organizations register and sign in exactly like users (code, then password or Google), and `ReportCase.resolved_by` points at a real admin account.
- **Immediate withdrawal of access.** Access tokens are not stored, and revoking refresh tokens alone would leave a signed-out or banned user in for up to 60 minutes. Each access token therefore carries the ID of the RefreshToken it was issued from, and protected endpoints check that this token is not revoked and that `Account.status` is `active`; a sign-out or a ban takes effect on the next request (SEC-005). A RefreshToken row is one session: if tokens are rotated, the new hash replaces the old one in the same row, so the session ID in access tokens and DeviceToken stays stable.
- **Encrypted lookups.** Column encryption uses a random IV, so the same number encrypts differently each time and cannot carry a unique index or a `WHERE`. Each encrypted phone number therefore has a companion `contact_hash` — an HMAC with a key held in the secrets store — which carries the unique index and every lookup (sign-in, resend throttle). Usernames are never searched, so they need no hash.
- **Registration states.** An account is `pending` from code verification until the date of birth passes the age check; a pending account can only finish registration — it cannot sign in, apply or post. An applicant under 18 never becomes `active` (SAFE-001). Organization accounts skip the date of birth and become `active` right after the code; administrator accounts are created by the team, not through registration.
- **Code delivery.** Every account registers with a phone number. Telegram is a delivery channel, not a separate kind of contact: codes are sent through the paid Telegram Gateway API, which delivers them as an official Telegram message to the account registered with that number, so no bot and no chat ID are needed. If the number has no Telegram account or delivery fails, the code goes by SMS. The code is generated and checked by us, so the limits of SEC-008 stay in our hands; `VerificationCode.channel` and `provider_request_id` record how the code went out, for delivery checks and cost tracking.
- **Contacts revealed on a match.** The verified phone number is the account's identity; the user can add a Telegram and an Instagram username as optional contacts. With `share_phone` switched off, a match reveals only the usernames, so a user need not give out their number; at least one contact must stay shared, otherwise the profile cannot be saved. Usernames are not verified — they are what the user chooses to share. All contact fields are encrypted at column level and released only on a mutual match after the safety acknowledgment (SEC-001, SEC-003, SAFE-002); matching reads the usernames and `share_phone` through the profiles interface and the phone number through the identity interface.
- **Cancelled proposals.** A proposal can end without either participant deciding: the event is cancelled (UC-001 E2), a participant is banned (E3) or withdraws (A5). Such a Match becomes `cancelled` with its reason; unlike `declined`, it creates no Exclusion and is not counted as a decline in statistics (FR-030). The affected applications become `cancelled` (event cancelled, user banned) or `withdrawn`; the other participant's application returns to the pool unless the event itself was cancelled. The other participant is told through `not_a_match` (ban, withdrawal) or `event_changed` (cancelled event).
- **Per-event answers and the profile format.** `Profile.communication_format` is the user's default and pre-fills the per-event question about the kind of company; matching compares only `per_event_answers`, whose questions are a fixed set in the matching module, versioned by `answers_version`.
- **Application and Match are separate.** An application means "I am in the pool"; a match is a proposal between two applications ([matching](mechanisms/matching.md)).
- **Exclusions.** A decline stores one row: the decliner excludes the declined ([matching](mechanisms/matching.md) rule 5). Because a pairing needs both sides, one row is enough to keep the pair from ever being proposed again in either direction, which is also what UC-001 A3 describes. The exclusion lasts until the event ends and does not carry over to other events (resolves OQ-003); `event_id` makes that check a single lookup. Reported and banned users are not copied into Exclusion: matching gets them from `moderation.exclusionsFor(userId)`, since no module reads another's tables.
- **Event sessions.** Sessions are created by the catalog module when the first user applies, so the import service never writes them. A single-day event has one session at `Event.starts_at`. A multi-day event (a month-long exhibition) gets one session per day, created when the first user applies for that day, starting at the time of day of `Event.starts_at`, computed in Europe/Kyiv so that daylight-saving changes do not shift it. Rounds, pools and proposals then work the same for both. When an event's time changes, the `event.changed` handler moves or cancels its sessions.
- **Venues.** Imported venues are written by the import service; organization venues by the main server, owned through `Venue.organization_id` so an organization picks its venue instead of retyping the address. The organization places the pin on the map when creating a venue, so the main server needs no geocoding. Imported venues take their coordinates from the provider; a record without coordinates is skipped and logged (FR-015). If too many records are skipped, geocoding can be added inside the provider adapter without touching anything else (FLEX-003). The import role can still technically modify organization venues, the same accepted risk as for events ([database access](mechanisms/database-access.md)).
- **Photo storage.** Photos are stored in PostgreSQL, in their own table, resized on upload. This needs no new infrastructure; the app host disk is not an option (FLEX-002). At the scale of one city the photos add a few hundred megabytes to each backup. **Reconsider if** backups or restore time (REL-004) grow noticeably: then photos move to an S3-compatible object store and ProfilePhoto keeps only the object key.
- **Audit log.** AuditLog stays in the moderation module (high-level design §2.1). Identity and the other modules that may not call moderation directly (high-level design §2.2) enqueue an `audit.record` job in the same transaction as the action, following the existing rule that a lower module triggers a higher one through a job; moderation writes the record. Nothing is lost, and the tier rule holds.
- **Safety notice** is `Profile.safety_notice_ack_at`, not a notification. It sits on Profile rather than Account because the profiles module owns the acknowledgment (high-level design §2.1) and only users with a profile can be matched; matching reads it through the profiles interface before revealing contacts (SAFE-002).
- **Table ownership** ([database access](mechanisms/database-access.md)): the import service writes imported Event and Venue rows, ImportRun and SkippedRecord; the main server only reads them. Everything else belongs to the main server.

## 6. Changes Needed in Other Documents

| Document | Change | Kind |
|---|---|---|
| high-level-design.md §2.2 | matching also depends on identity (phone number for the contact reveal) | architecture, one row |
| high-level-design.md §3 I3 | new job `audit.record`: producers identity and the other modules below moderation, consumer moderation | architecture, one row |
| high-level-design.md §3 I4 | organization-created venues are written by CMP-02 | architecture, one row |
| [authentication.md](mechanisms/authentication.md) | registration is always by phone number; Telegram is a delivery channel through the Telegram Gateway API, SMS the fallback | team decision |
| [matching.md](mechanisms/matching.md) Open | multi-day events split into daily sessions | closes an open item |
| requirements.md §6 | OQ-003 resolved: exclusion lasts until the event ends | closes an open question |

## AI Usage Note

Drafted with Claude from the project's requirements and architecture documents and the team's review notes. The PlantUML diagram was rendered to check syntax. Reviewed and edited by Daryna Halytska.