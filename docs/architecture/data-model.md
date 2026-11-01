# Data Model

Entity–relationship model of Nearby's PostgreSQL schema (CMP-04, [ADR-002](decisions/ADR-002.md)).

Diagram: [ER diagram](uml/rendered/data-model.svg) (source: [`uml/data-model.puml`](uml/data-model.puml))

## 1. Key Functions Covered

| Key function (Project-Description.md) | Entities |
|---|---|
| Registration and sign-in | Account, AuthMethod, VerificationCode, RefreshToken |
| User profile | Profile, ProfilePhoto, LinkedAccount, Interest, ProfileInterest |
| Event catalog (organization posts + import) | Organization, Category, Venue, Event, EventSession, ImportRun, SkippedRecord |
| Event-based matching | Application, Match, Exclusion |
| Contact exchange after a match | Account.contact_identifier, LinkedAccount, Match.status, Profile.safety_notice_ack_at |
| Listings | Listing |
| Notifications | Notification, DeviceToken |
| Reports and moderation | ReportCase, Report, AuditLog |

## 2. Entities

Notation: **PK** primary key, **FK** foreign key, **UK** unique. Sensitivity marks (S), (C), (P) are defined in §4. Every table also has `created_at` and, where rows change, `updated_at`; all times are `timestamptz`.

### identity

| Entity | Key | Main attributes |
|---|---|---|
| **Account** | PK `id` | `role` (user / admin), `contact_identifier` (S, encrypted) — the verified phone number (E.164), revealed on a mutual match unless `Profile.share_phone` is off; null while sign-in is Google-only ([ADR-004](decisions/ADR-004.md)), `contact_hash` (UK, nullable) — HMAC of the number with a key from the main server's env file; the encrypted value cannot be indexed, so uniqueness and every lookup go through the hash, `date_of_birth` (S, SAFE-001), `status` (pending / active / banned) — `pending` until the date of birth passes the age check; a pending account can only finish registration, `failed_signins`, `failed_signins_since` — the first failure counted in the current 15-minute window, `locked_until` (SEC-007). Administrator accounts are created by the team. |
| **AuthMethod** | PK `id` | `account_id` FK, `type` (password / google), `secret` — argon2id hash (C) for a password, Google `sub` (P) for Google; UK (`account_id`, `type`), UK (`type`, `secret`) |
| **VerificationCode** | PK `id` | `contact` (S, encrypted) — phone number, `contact_hash` — for the resend throttle, `channel` (telegram / sms) — Telegram Gateway API first, SMS as fallback; null until a provider takes the code, `provider_request_id` — for delivery checks and cost tracking, `code_hash` (C), `purpose` (registration / reset), `sent_at`, `expires_at`, `attempts`, `used_at` (SEC-008). No FK: the code is sent before the account exists. |
| **RefreshToken** | PK `id` | `account_id` FK, `token_hash` (C), `expires_at`, `revoked_at` (SEC-005). One row is one session: access tokens carry its ID, so a sign-out or ban takes effect on the next request; rotation replaces the hash in the same row. |

### profiles

| Entity | Key | Main attributes |
|---|---|---|
| **Profile** | PK = FK `account_id` | `username` (P, UK, required, case-insensitive), `display_name` (P), `description` (P), `occupation` (P) — studies or work, free text, `communication_format` (S, nullable until picked during onboarding) — the default that pre-fills `Application.desired_company`; the API calls `casual` `company`, `share_phone` (default true), `safety_notice_ack_at` (FR-032, SAFE-002) |
| **ProfilePhoto** | PK = FK `profile_id` | `content` (S, bytea), `content_type` — resized on upload; kept apart from Profile so that profile reads do not load the image |
| **LinkedAccount** | PK `id` | `profile_id` FK, `app` (telegram / instagram / … — enum defined in code), `username` (S, encrypted) — the bare handle in a social network, revealed on a mutual match; a profile keeps at least one while sign-in is Google-only; UK (`profile_id`, `app`) |
| **Interest** | PK `id` | `name` (UK) — a fixed list seeded at launch; users pick from it, `group_name` — the heading it is shown under, `group_position` — the order of its group; columns rather than a table, since groups have no data of their own |
| **ProfileInterest** | PK (`profile_id`, `interest_id`) | junction table |

### catalog

| Entity | Key | Main attributes |
|---|---|---|
| **Organization** | PK = FK `account_id` | `name`, `description`, `official_link`, `verification_status` (pending / verified / rejected / revoked), `verified_by` FK → Account (admin), `verified_at`. An organization is a regular user account with this extra row; it publishes events only when `verified`, and verification is done by the team. |
| **Category** | PK `id` | `name` (UK), `is_active` (FR-029) |
| **Venue** | PK `id` | `name`, `address`, `latitude`, `longitude` (FR-012) — placed on the map by the organization or taken from the provider, `source` (organization / import), `organization_id` FK (organization venues only) |
| **Event** | PK `id` | `category_id` FK, `venue_id` FK, `organization_id` FK (null for imported), `source` (organization / import), `provider` and `external_id` (imported only, UK together — re-import updates the same row), `title`, `description`, `starts_at`, `ends_at` (FR-007 date filter; when a provider gives no end, the end of the start day in Europe/Kyiv), `status` (published / cancelled) |
| **EventSession** | PK `id` | `event_id` FK, `starts_at`, `status` (scheduled / cancelled); UK (`event_id`, `starts_at`). Matching rounds are anchored here ([matching](mechanisms/matching.md)). Created when the first user applies: one session for a single-day event, one per day for a multi-day event, at the time of day of `Event.starts_at` in Europe/Kyiv. |

### import (CMP-03)

| Entity | Key | Main attributes |
|---|---|---|
| **ImportRun** | PK `id` | `provider`, `started_at`, `finished_at`, `status` — the last successful run gives the "last updated" notice (FR-014) |
| **SkippedRecord** | PK `id` | `import_run_id` FK, `raw` (jsonb), `reason` (FR-015) — e.g. a record without coordinates |

### matching

| Entity | Key | Main attributes |
|---|---|---|
| **Application** | PK `id` | `user_id` FK, `session_id` FK, `desired_company` (S; friends / casual / dating), `open_to_extend` (S; bool) — answers to the matching questions, which are the same for every event; each new question becomes a new column, `status` (in_pool / paired / paused / removed / withdrawn / no_match / cancelled) — `paused`: first unanswered proposal, waiting for the user to confirm "continue matching?"; `removed`: second unanswered proposal; `cancelled`: the event was cancelled or the user banned, `no_response_count` (0–2) — unanswered proposals in this application ([matching](mechanisms/matching.md) rule 6); a new application for the same session starts at 0, `created_at` — order in open mode |
| **Match** | PK `id` | `application_a_id` FK, `application_b_id` FK, `source` (instant / round / open), `score` — the share of matching interests, 0–1, `decimal(4,3)` (threshold: [matching](mechanisms/matching.md)), `seed` (FUNC-001), `status` (proposed / accepted_a / accepted_b / mutual / declined / expired / cancelled), `cancel_reason` (event_cancelled / participant_banned / participant_withdrew) — `cancelled` creates no Exclusion and does not count as a decline, `valid_until` = min(`created_at` + 24 h, start of the next round, or the cutoff after the last round); at that moment the `matching.expire` job writes `expired` and applies a strike to each participant who did not respond (both, if neither did) |
| **Exclusion** | PK `id` | `user_id` FK, `excluded_user_id` FK, `event_id` FK, `match_id` FK, `reason` (declined / expired) — one row per declined or expired proposal; the check is symmetric, so one row keeps the pair apart in both directions until the event ends. Reported and banned users come from `moderation.exclusionsFor(userId)` and are not copied here. |

### listings

| Entity | Key | Main attributes |
|---|---|---|
| **Listing** | PK `id` | `author_id` FK, `category_id` FK, `event_id` FK (optional), `title`, `description` (P), `date`, `status` (active / removed) |

### moderation

| Entity | Key | Main attributes |
|---|---|---|
| **ReportCase** | PK `id` | `target_type` (account / listing), `target_account_id` or `target_listing_id` FK (exactly one set), `status` (open / resolved), `resolution` (banned / removed / dismissed), `resolved_by` FK → Account (admin), `resolved_at`. At most one open case per target (FR-026). |
| **Report** | PK `id` | `case_id` FK, `reporter_id` FK, `reason`, `comment` (P) |
| **AuditLog** | PK `id` | `created_at`, `actor_id`, `action`, `target_type`, `target_id`, `result`, `ip_address` (P). Append-only; `actor_id` has no FK so records outlive accounts (SEC-004). Other modules write it through an `audit.record` job enqueued in the same transaction as the action. |

### notifications

| Entity | Key | Main attributes |
|---|---|---|
| **Notification** | PK `id` | `account_id` FK, `type` (match_proposed / match_mutual / respond_soon / not_a_match / continue_matching / removed_from_matching / no_match_found / event_reminder / event_changed / report_received) — `continue_matching` carries a "yes" action (first strike), `removed_from_matching` follows the second strike, `payload` (P, jsonb), `dedupe_key` (UK), `push_status` (pending / sent / failed / skipped), `read_at` — the row is the inbox item ([notifications](mechanisms/notifications.md)). A `match_mutual` payload never contains contact details — the client fetches them from `/matches`, where SEC-001 and SAFE-002 are enforced. |
| **DeviceToken** | PK `id` | `account_id` FK, `refresh_token_id` FK — the service deletes the row when that session is revoked (sign-out); the FK cascade only removes what is left when expired tokens are cleaned up daily, `push_token` (P, UK), `platform` (ios / android) |

## 3. Relationships

| Relationship | Cardinality | Note |
|---|---|---|
| Account — AuthMethod | 1 : 0..* | one account, several sign-in methods |
| Account — RefreshToken | 1 : 0..* | |
| Account — Profile | 1 : 0..1 | the profile shows the age computed from `Account.date_of_birth` |
| Account — Organization | 1 : 0..1 | the account acts as an organization |
| Account (admin) — Organization | 0..1 : 0..* | `verified_by`: the administrator who verified the organization |
| Profile — ProfilePhoto | 1 : 0..1 | |
| Profile — LinkedAccount | 1 : 0..* | at most one per app |
| Profile — Interest | M : N | via ProfileInterest |
| Organization — Event | 0..1 : 0..* | imported events have no organization |
| Organization — Venue | 0..1 : 0..* | imported venues have no organization |
| Category — Event, Category — Listing | 1 : 0..* | |
| Venue — Event | 1 : 0..* | |
| Event — EventSession | 1 : 0..* | none until someone applies |
| ImportRun — SkippedRecord | 1 : 0..* | |
| Account — Application | 1 : 0..* | at most one active application per user and session |
| EventSession — Application | 1 : 0..* | the session's pool |
| Application — Match | 1 : 0..* (as A or B) | each Match joins exactly two applications; an application has at most one open match at a time (FUNC-002) |
| Match — Exclusion | 1 : 0..1 | a row when the match was declined or expired |
| Event — Exclusion | 1 : 0..* | an exclusion is scoped to one event |
| Account — Exclusion | 1 : 0..* | as the user and as the excluded user |
| Account — Listing | 1 : 0..* | |
| Event — Listing | 0..1 : 0..* | a listing may point at a catalog event |
| ReportCase — Report | 1 : 1..* | repeat reports grouped into one case (FR-026) |
| Account — Report | 1 : 0..* | reporter |
| ReportCase — target | 0..1 Account or 0..1 Listing | |
| Account (admin) — ReportCase | 0..1 : 0..* | `resolved_by`: the administrator who resolved the case |
| Account — Notification, Account — DeviceToken | 1 : 0..* | |
| RefreshToken — DeviceToken | 1 : 0..1 | no push after sign-out |

### Invariants and How They Are Enforced

| Invariant | Enforced by |
|---|---|
| Usernames are unique regardless of case | unique index on `lower(username)` |
| One linked account per app | UK (`profile_id`, `app`) |
| One password and one Google account per account, and a Google account linked to one account only | UK (`account_id`, `type`) and UK (`type`, `secret`) on AuthMethod |
| One active application per user and session | partial unique index on (`user_id`, `session_id`) where `status` in (in_pool, paired, paused) — a paused user cannot skip the "continue?" step by applying again; `removed` stays outside, so a removed user may apply again |
| One open case per report target | partial unique index on the target where `status = open` |
| Exactly one target in a ReportCase | CHECK |
| A Match joins two different applications | CHECK (`application_a_id <> application_b_id`) |
| An active account has a date of birth (SAFE-001) | CHECK (`status <> 'active' OR date_of_birth IS NOT NULL`) — the database checks only that the date exists; the date is encrypted, so the age of at least 18 is checked by the service (identity) before the status becomes `active` |
| A failure count has the start of its window (SEC-007) | CHECK (`(failed_signins = 0) = (failed_signins_since IS NULL)`) and CHECK (`failed_signins >= 0`); the threshold of 5 is checked by the service (identity) |
| Both applications of a Match belong to the same session | service (matching), under the per-session lock |
| At least one shared contact (`share_phone` or a linked account) | service (profiles): a linked account, while sign-in is Google-only and there is no phone — spans two tables |
| Only verified organizations publish events; organization accounts do not apply for matching | service — the data lives in other modules |

## 4. Personal and Sensitive Data

- **(C) Credential** — never returned by the API, never logged; stored only as a hash.
- **(S) Sensitive personal** — exposure harms the user directly (contact, exact date of birth, dating intent, face); access is restricted and encrypted at rest.
- **(P) Personal** — identifies or describes a person but is visible to other users by design, or is technical data tied to a person.

| Data | Where | Class | Protection |
|---|---|---|---|
| Password hash | AuthMethod.secret | C | argon2id (SEC-002) |
| Verification code, refresh token | VerificationCode.code_hash, RefreshToken.token_hash | C | stored hashed; expiry and revocation (SEC-005, SEC-008) |
| Phone number, linked-account usernames | Account.contact_identifier, VerificationCode.contact, LinkedAccount.username | S | column-level encryption (SEC-003); the phone number is looked up only through `contact_hash`; account and linked contacts are revealed only after mutual acceptance and safety acknowledgment (SEC-001, SAFE-002); VerificationCode.contact is never revealed |
| Date of birth | Account.date_of_birth | S | encrypted at rest (SEC-003); other users see only the age, computed on the server |
| Photo | ProfilePhoto.content | S | encrypted at rest with the database volume; served only through an authenticated API endpoint, never as a public link |
| Communication format, per-event answers | Profile.communication_format, Application.desired_company, Application.open_to_extend | S | reveal a "dating" preference; shown only to a proposed match |
| Google subject ID | AuthMethod.secret (type google) | P | never returned by the API |
| Username, display name, description, interests, age | Profile, ProfileInterest | P | shown to other signed-in users by design, never to guests. The description is free text and may contain whatever the user chooses to disclose; reports (FR-025) cover misuse. |
| Listing text, report comment | Listing.description, Report.comment | P | report comments visible to administrators only |
| Notification content | Notification.payload | P | owner only |
| Push token | DeviceToken.push_token | P | never returned by the API |
| IP address | AuditLog.ip_address | P | audit log retention (SEC-004, OQ-002) |

**Not stored:** the user's location (the map centres on the device, FR-012), profile drafts (kept on the client, FR-004) and guest tokens (signed, verified without a lookup). Rate-limit counters are short-lived and kept in the memory of the API process (`@nestjs/throttler`, per IP on the auth endpoints); the planned catalog limits key them on the token as well as the IP ([catalog access](mechanisms/catalog-access.md), ADR-002). Account lockout is the only limit stored here.

## AI Usage Note

Drafted with Claude from the project's requirements and architecture documents and the team's review notes. Reviewed and edited by Daryna Halytska.
