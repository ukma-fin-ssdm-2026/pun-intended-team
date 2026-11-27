# Data Model

Entity–relationship model of Nearby's PostgreSQL schema (CMP-04, [ADR-002](decisions/ADR-002.md)).

Diagram: [ER diagram](uml/rendered/data-model.svg) (source: [`uml/data-model.puml`](uml/data-model.puml))

## 1. Key Functions Covered

| Key function (Project-Description.md) | Entities |
|---|---|
| Registration and sign-in | Account, AuthMethod, VerificationCode, RefreshToken |
| User profile | Profile, Image, LinkedAccount, Interest, ProfileInterest |
| Event catalog (organization posts + import) | Organization, Category, Venue, Event, EventSession, ImportRun, SkippedRecord |
| Event-based matching | Application, ApplicationSession, ApplicationAfterEventPlan, Match, Exclusion |
| Contact exchange after a match | Account.contact_identifier, LinkedAccount, Match.status, ListingRequest.status, Profile.safety_notice |
| Listings | Listing, ListingRequest, Image |
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
| **RefreshToken** | PK `id` | `account_id` FK, `token_hash` (C), `previous_token_hash` (C) and `rotated_at` — the hash the last renewal replaced and when, accepted for 60 s as the retry of a lost answer (REL-08), `expires_at`, `revoked_at` (SEC-005). One row is one session: access tokens carry its ID, so a sign-out or ban takes effect on the next request; rotation replaces the hash in the same row. |

### profiles

| Entity | Key | Main attributes |
|---|---|---|
| **Profile** | PK = FK `account_id` | `username` (P, UK, required, case-insensitive), `display_name` (P), `description` (P), `occupation` (P) — studies or work, free text, `communication_format` (S, nullable until picked during onboarding) — the default that pre-fills `Application.desired_company`; the API calls `casual` `company`, `gender` (S; female / male / other, nullable: profiles made before it was asked have none and are incomplete until the user picks one) — matching filters on it ([matching](mechanisms/matching.md), policy), `gender_description` (S) — the user's own words for `other`, at most 50 characters; set only with `other`, `share_phone` (default true), `safety_notice` (not_acknowledged / acknowledged / hidden, default not_acknowledged; FR-032, SAFE-002), `photo_id` and `cover_id` (FK → Image, UK, nullable) — the avatar and the cover behind it |
| **LinkedAccount** | PK `id` | `profile_id` FK, `app` (telegram / instagram / … — enum defined in code), `username` (S, encrypted) — the bare handle in a social network, revealed on a mutual match; a profile keeps at least one while sign-in is Google-only; UK (`profile_id`, `app`) |
| **Interest** | PK `id` | `name` (UK) — a fixed list seeded at launch; users pick from it, `group_name` — the heading it is shown under, `group_position` — the order of its group; columns rather than a table, since groups have no data of their own |
| **ProfileInterest** | PK (`profile_id`, `interest_id`) | junction table |

### catalog

| Entity | Key | Main attributes |
|---|---|---|
| **Organization** | PK = FK `account_id` | `name`, `description`, `official_link`, `instagram` (nullable: the bare username, shown on the public organizer page), `verification_status` (pending / verified / rejected / revoked), `verified_by` FK → Account (admin), `verified_at`, `logo_id` FK → Image (UK, nullable). An organization is a regular user account with this extra row; it publishes events only when `verified`, and verification is done by the team. |
| **Category** | PK `id` | `name` (UK; unique once normalized, see invariants), `slug` (UK; set once when the category is created and never changed, also on a rename: the seeded ones by the migration, the others made by the server from the name in Latin, `-2`, `-3`… when taken), `is_active` (FR-029). Seeded: Концерти, Виставки, Лекції, Майстер-класи, Кіно, Театр, Стендап, Спорт, Фестивалі, Вечірки, Волонтерство and Дні відкритих дверей, with the slugs `concerts`, `exhibitions`, `talks`, `workshops`, `cinema`, `theatre`, `stand-up`, `sports`, `festivals`, `parties`, `volunteering` and `open-days`; the import maps providers' genres to the first ten by slug ([ADR-006](decisions/ADR-006.md)), Волонтерство and Дні відкритих дверей have listings only |
| **Venue** | PK `id` | `name`, `address`, `latitude`, `longitude` (FR-012) — placed on the map by the organization, taken from the provider, or found by the geocoder for a provider that gives none, `source` (organization / import), `organization_id` FK (organization venues only) |
| **Event** | PK `id` | `category_id` FK, `venue_id` FK, `organization_id` FK (null for imported), `source` (organization / import), `provider` and `external_id` (imported only, UK together — re-import updates the same row), `title`, `description`, `image_url` and `source_url` (imported only, nullable: the provider's image and event page, linked, never copied), `photo_id` FK → Image (UK, nullable: the cover an organization uploaded), `starts_at`, `start_time_known` (false for an imported event whose provider gives no time of day, an exhibition run without opening hours, so `starts_at` is a default 12:00 in Europe/Kyiv; true by default and for every organization event; ADR-006, decision 5), `ends_at` (FR-007 date filter; when a provider gives no end, the end of the start day in Europe/Kyiv, or of the last day of a run of shows), `end_time_known` (false for an imported event whose provider gives no end, so `ends_at` is that placeholder; true by default and for every organization event; ADR-006, decision 5), `price_min` and `price_max` (nullable integers, whole hryvnias: both null when the price is unknown, `price_min` alone for one price, `price_min` 0 without a higher `price_max` for a free event, both for a range; set by the organization or read from the provider, ADR-006, decision 12), `status` (published / cancelled) |
| **EventSession** | PK `id` | `event_id` FK, `starts_at`, `status` (scheduled / cancelled); UK (`event_id`, `starts_at`). Matching rounds are anchored here ([matching](mechanisms/matching.md)). Created when the first user applies: one session for a single-day event, one per day for a multi-day event, at the time of day of `Event.starts_at` in Europe/Kyiv. A session is never moved: when its day starts at another time, its applications go to the session at the new time and it is `cancelled` ([matching](mechanisms/matching.md), rule 10). |

### import (CMP-03)

| Entity | Key | Main attributes |
|---|---|---|
| **ImportRun** | PK `id` | `provider`, `started_at`, `finished_at`, `status` — the last successful run gives the "last updated" notice (FR-014); `complete`, `seen` and `parts` (records per Karabas section) — whether the run read the provider's full list, which the next run compares itself with before it cancels events the provider no longer lists (ADR-006) |
| **SkippedRecord** | PK `id` | `import_run_id` FK, `raw` (jsonb), `reason` (FR-015) — e.g. a page the provider could not render, or a venue the geocoder cannot find |

### matching

| Entity | Key | Main attributes |
|---|---|---|
| **Application** | PK `id` | `user_id` FK, `event_id` FK — the days the user can go are in ApplicationSession, `desired_company` (S; friends / casual / dating) — the answer to the matching question on the kind of company, the same for every event; the plans after the event are in ApplicationAfterEventPlan, `preferred_gender` (S; any / female / male, default any), `age_min` (default 18) and `age_max` (null: no upper bound, "60+" in the app) — whom the user wants to go with; matching pairs two users only if each fits the other's ([matching](mechanisms/matching.md), policy), `status` (in_pool / paired / paused / removed / withdrawn / no_match / cancelled) — `paused`: first unanswered proposal, waiting for the user to confirm "continue matching?"; `removed`: second unanswered proposal; `cancelled`: the event was cancelled or the user banned, `no_response_count` (0–2) — unanswered proposals in this application ([matching](mechanisms/matching.md) rule 6); a new application for the same session starts at 0, `created_at` — order in open mode, `dismissed_at` — when the user dismissed a `no_match` application; until then it is listed (FR-018) |
| **ApplicationSession** | PK (`application_id`, `session_id`) | junction table: the days of the event the user can go, any one of which suits them; one row for a single-day event. A match lists the days both applications list, and the two users pick one themselves ([matching](mechanisms/matching.md), rule 9) |
| **ApplicationAfterEventPlan** | PK (`application_id`, `plan`) | junction table: `plan` (S; walk / coffee / dinner) — what the user would do together after the event; no rows means only the event |
| **Match** | PK `id` | `application_a_id` FK, `application_b_id` FK, `source` (instant / round / open), `score` — the pair score, 0–1, `decimal(4,3)` (threshold: [matching](mechanisms/matching.md)), `seed` (FUNC-001), `status` (proposed / accepted_a / accepted_b / mutual / declined / expired / cancelled), `cancel_reason` (event_cancelled / event_changed / participant_banned / participant_withdrew; `event_changed`: a day the two share now starts at another time; a mutual match is cancelled only with `event_cancelled`, when its event or its shared days are cancelled, [matching](mechanisms/matching.md) rule 10) — `cancelled` creates no Exclusion and does not count as a decline, `valid_until` = min(`created_at` + 24 h, the next round on any day the two share, the cutoff of the last shared day); at that moment the `matching.expire` job writes `expired` and applies a strike to each participant who did not respond (both, if neither did) |
| **Exclusion** | PK `id` | `user_id` FK, `excluded_user_id` FK, `event_id` FK, `match_id` FK, `reason` (declined / expired) — one row per declined or expired proposal; the check is symmetric, so one row keeps the pair apart in both directions until the event ends. Reported and banned users come from `moderation.exclusionsFor(userIds)` and are not copied here. |

### listings

| Entity | Key | Main attributes |
|---|---|---|
| **Listing** | PK `id` | `author_id` FK, `category_id` FK, `event_id` FK (optional), `title`, `description` (P), `date`, `status` (active / removed), `photo_id` (FK → Image, UK, nullable), `place_name`, `place_address`, `place_latitude`, `place_longitude` (nullable: where the author suggests meeting, a point in Kyiv picked on the map with its name and address; kept on the listing, not a Venue) |
| **ListingRequest** | PK `id` | `listing_id` FK, `requester_id` FK → Account, `status` (pending / accepted / declined), `created_at`, `decided_at` (nullable: when the author answered) — "Хочу піти" on someone else's listing; once accepted, both sides see each other's contacts after the safety notice, as on a mutual match. A pending request on a removed listing can no longer be read or decided |

### images

| Entity | Key | Main attributes |
|---|---|---|
| **Image** | PK `id` | `owner_id` FK → Account, `content` (S, bytea) — WebP, `content_type`, `width`, `height`, `crop_left`, `crop_top`, `crop_width`, `crop_height` — for a cover, kept whole, the area the user picked in pixels of the stored picture; null for pictures stored cropped. `is_public`: an event cover or an organization's logo, which a guest token may get. A new upload is a new row, so a picture never changes; the row being replaced is deleted. Kept apart from Profile and Listing so that their reads do not load the picture ([HLD §2.3](high-level-design.md#23-uploaded-pictures)). |

### moderation

| Entity | Key | Main attributes |
|---|---|---|
| **ReportCase** | PK `id` | `target_type` (account / listing), `target_account_id` or `target_listing_id` FK (exactly one set), `status` (open / resolved), `resolution` (banned / removed / dismissed), `resolved_by` FK → Account (admin), `resolved_at`. At most one open case per target (FR-026). |
| **Report** | PK `id` | `case_id` FK, `reporter_id` FK, `reason`, `comment` (P) |
| **AuditLog** | PK `id` | `created_at`, `actor_id`, `action`, `target_type`, `target_id`, `result`, `ip_address` (P). Append-only; `actor_id` has no FK so records outlive accounts (SEC-004). Other modules write it through an `audit.record` job enqueued in the same transaction as the action. |

### notifications

| Entity | Key | Main attributes |
|---|---|---|
| **Notification** | PK `id` | `account_id` FK, `type` (match_proposed / match_mutual / respond_soon / not_a_match / continue_matching / removed_from_matching / no_match_found / event_reminder / event_changed / report_received / listing_request / listing_request_accepted) — `continue_matching` carries a "yes" action (first strike), `removed_from_matching` follows the second strike, `payload` (P, jsonb), `dedupe_key` (UK), `push_status` (pending / sent / failed / skipped), `read_at` — the row is the inbox item ([notifications](mechanisms/notifications.md)). A `match_mutual` payload never contains contact details — the client fetches them from `/matches`, where SEC-001 and SAFE-002 are enforced. |
| **DeviceToken** | PK `id` | `account_id` FK, `refresh_token_id` FK — the service deletes the row when that session is revoked (sign-out); the FK cascade only removes what is left when expired tokens are cleaned up daily, `push_token` (P, UK), `platform` (ios / android) |

### admin

| Entity | Key | Main attributes |
|---|---|---|
| **BackupRun** | PK `id` | `finished_at`, `succeeded`, `attempts`, `duration_seconds`, `size_bytes` (null when failed), `reason` — a code (unreachable / auth_failed / timeout / locked / unreadable / failed), null when it succeeded; the error message stays in the backup log. One row per nightly backup, written by `deploy/backup-db.sh` when it ends, so it has no `created_at`; the admin panel warns when the last one failed or is older than 26 h |

## 3. Relationships

| Relationship | Cardinality | Note |
|---|---|---|
| Account — AuthMethod | 1 : 0..* | one account, several sign-in methods |
| Account — RefreshToken | 1 : 0..* | |
| Account — Profile | 1 : 0..1 | the profile shows the age computed from `Account.date_of_birth` |
| Account — Organization | 1 : 0..1 | the account acts as an organization |
| Account (admin) — Organization | 0..1 : 0..* | `verified_by`: the administrator who verified the organization |
| Account — Image | 1 : 0..* | the uploader; their pictures go with the account |
| Profile — Image | 0..1 : 0..1 | `photo_id` and `cover_id`, each pointing at an image of its own |
| Listing — Image | 0..1 : 0..1 | `photo_id` |
| Profile — LinkedAccount | 1 : 0..* | at most one per app |
| Profile — Interest | M : N | via ProfileInterest |
| Organization — Event | 0..1 : 0..* | imported events have no organization |
| Organization — Venue | 0..1 : 0..* | imported venues have no organization |
| Category — Event, Category — Listing | 1 : 0..* | |
| Venue — Event | 1 : 0..* | |
| Event — EventSession | 1 : 0..* | none until someone applies |
| ImportRun — SkippedRecord | 1 : 0..* | |
| Account — Application | 1 : 0..* | at most one active application per user and event |
| Event — Application | 1 : 0..* | the event's applications |
| Application — EventSession | M : N | via ApplicationSession: the days each application waits in the pool of |
| Application — ApplicationAfterEventPlan | 1 : 0..3 | each plan at most once |
| Application — Match | 1 : 0..* (as A or B) | each Match joins exactly two applications; an application has at most one open match at a time (FUNC-002) |
| Match — Exclusion | 1 : 0..1 | a row when the match was declined or expired |
| Event — Exclusion | 1 : 0..* | an exclusion is scoped to one event |
| Account — Exclusion | 1 : 0..* | as the user and as the excluded user |
| Account — Listing | 1 : 0..* | |
| Event — Listing | 0..1 : 0..* | a listing may point at a catalog event |
| Listing — ListingRequest | 1 : 0..* | |
| Account — ListingRequest | 1 : 0..* | requester; at most one request per listing |
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
| Category names are unique regardless of case, spaces and apostrophe (' ’ ʼ) | unique index on `name` in lower case, trimmed, with runs of spaces as one and every apostrophe as ʼ; the service saves names normalized the same way, apart from the case |
| A category keeps its slug | the API accepts no slug and the service never passes one on an update |
| One linked account per app | UK (`profile_id`, `app`) |
| One password and one Google account per account, and a Google account linked to one account only | UK (`account_id`, `type`) and UK (`type`, `secret`) on AuthMethod |
| One active application per user and event | partial unique index on (`user_id`, `event_id`) where `status` in (in_pool, paired, paused) — a paused user cannot apply again alongside the paused application; `removed` and `withdrawn` stay outside, so a removed user may apply again, and so may a paused user who withdraws, skipping the "continue?" step with no strikes, like a removed user (rule 6) |
| One open case per report target | partial unique index on the target where `status = open` |
| Exactly one target in a ReportCase | CHECK |
| A Match joins two different applications | CHECK (`application_a_id <> application_b_id`) |
| An event's price is not negative, and its highest price comes only with a lowest one and is not below it | CHECK on `price_min` (>= 0) and on `price_max` (null, or `price_min` not null and `price_max >= price_min`); the API's zod schema answers `400` first |
| A gender description goes with the gender `other` only | CHECK (`(gender IS NOT DISTINCT FROM 'other') = (gender_description IS NOT NULL)`) on Profile |
| An application's age range starts at 18 and does not end below its start | CHECK (`age_min >= 18 AND (age_max IS NULL OR age_max >= age_min)`) on Application |
| One request per user and listing | UK (`listing_id`, `requester_id`) |
| A listing request has its decision time exactly when it is decided | CHECK `listing_requests_decided_check` (`(status = 'pending') = (decided_at IS NULL)`); that only the author decides, and not on their own listing, is checked by the service (listings) |
| A listing's place is all set or all null | CHECK `listings_place_check` on the four `place_*` columns; that the point is in Kyiv is checked by the service (listings) |
| An active account has a date of birth (SAFE-001) | CHECK (`status <> 'active' OR date_of_birth IS NOT NULL`) — the database checks only that the date exists; the date is encrypted, so the age of at least 18 is checked by the service (identity) before the status becomes `active` |
| A cover's crop is all set or all null, and lies inside the picture | CHECK on Image; its shape (390:200) is set by the service (images) |
| A failure count has the start of its window (SEC-007) | CHECK (`(failed_signins = 0) = (failed_signins_since IS NULL)`) and CHECK (`failed_signins >= 0`); the threshold of 5 is checked by the service (identity) |
| Both applications of a Match belong to the same event and list at least one day in common | service (matching), under the per-event lock |
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
| Profile photo, cover, listing photo | Image.content | S | encrypted at rest with the database volume; metadata, the camera location included, dropped on upload; served only to signed-in users through `GET /images/{id}`, never as a public link (TM-14) |
| Communication format, per-event answers | Profile.communication_format, Application.desired_company, ApplicationAfterEventPlan.plan | S | reveal a "dating" preference; shown only to a proposed match |
| Gender, whom the user wants to go with | Profile.gender, Profile.gender_description, Application.preferred_gender, Application.age_min, Application.age_max | S | encrypted at rest with the database volume, not column-encrypted: matching filters the pool on them, and SEC-003 asks column encryption of contact data, which these are not (TM-07, accepted); returned only to their owner, never to other users or a proposed match |
| Google subject ID | AuthMethod.secret (type google) | P | never returned by the API |
| Username, display name, description, interests, age | Profile, ProfileInterest | P | shown to other signed-in users by design, never to guests. The description is free text and may contain whatever the user chooses to disclose; reports (FR-025) cover misuse. |
| Listing text, report comment | Listing.description, Report.comment | P | report comments visible to administrators only |
| Notification content | Notification.payload | P | owner only |
| Push token | DeviceToken.push_token | P | never returned by the API |
| IP address | AuditLog.ip_address | P | audit log retention (SEC-004, OQ-002) |

**Not stored:** the user's location (the map centres on the device, FR-012), profile drafts (kept on the client, FR-004) and guest tokens (signed, verified without a lookup). Rate-limit counters are short-lived and kept in the memory of the API process (`@nestjs/throttler`, per IP on the auth endpoints); the planned catalog limits key them on the token as well as the IP ([catalog access](mechanisms/catalog-access.md), ADR-002). Account lockout is the only limit stored here.

## AI Usage Note

Drafted with Claude from the project's requirements and architecture documents and the team's review notes. Reviewed and edited by Daryna Halytska.
