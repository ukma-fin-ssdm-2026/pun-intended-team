# Data Model (draft)

## 1. Entities

### 1.1 User
An individual account holder who browses events, requests matches and posts listings (FR-001, FR-002). Must be 18+ (SAFE-001).

- `id` — UUID, **PK**
- `contact_identifier` — string `*` (email or phone; sign-in identifier per OQ-001, also used for FR-005 code delivery)
- `password_hash` — string, nullable `*` (SEC-002, argon2id; nullable if sign-in ends up passwordless per OQ-001)
- `date_of_birth` — date `*` (SEC-003, SAFE-001)
- `is_verified` — boolean (FR-005)
- `is_banned` — boolean (FR-027)
- `safety_notice_ack_at` — timestamp, nullable (SAFE-002, FR-032)
- `created_at` — timestamp

**Relationships:** 1—1 Profile · 1—N Listing (author) · 1—N Match (as participant A or B) · 1—N Report (as reporter) · 1—N DeviceToken · 1—N NotificationOutbox (recipient)

### 1.2 Profile
1:1 extension of `User` holding the matching-relevant data (FR-002, FR-004).

- `id` — UUID, **PK**
- `user_id` — UUID, **FK → User**, unique
- `description` — text
- `photo_url` — string `*` (personally identifying image data)
- `communication_format` — enum(`friends`, `dating`, `company`)
- `contact_link` — string `*` (SEC-003; the sole contact info revealed to the other side, and only after a mutual match, FR-019)
- `is_draft` — boolean (FR-004, in-progress profiles are saved and restored)

**Relationships:** 1—1 User · M—N Interest (via `Profile_Interest` join table)

### 1.3 Interest
Reference catalog of interest tags used for matching (FR-002, FR-017).

- `id` — UUID, **PK**
- `name` — string, unique

**Relationships:** M—N Profile (via `Profile_Interest(profile_id, interest_id)`)

### 1.4 Organization
Venue/organizer account; posts events but does not take part in matching (FR-003).

- `id` — UUID, **PK**
- `name` — string
- `email` — string
- `password_hash` — string `*` (SEC-002)
- `is_banned` — boolean
- `created_at` — timestamp

**Relationships:** 1—N Event (publisher)

### 1.5 Event
A catalog item — concert, exhibition, lecture, etc. (FR-006–FR-015).

- `id` — UUID, **PK**
- `title` — string
- `description` — text
- `category_id` — UUID, **FK → Category**
- `date_time` — timestamp
- `location` — string / geo coordinates (for the map view, FR-012)
- `source` — enum(`organization`, `external_import`) (FR-008)
- `organization_id` — UUID, **FK → Organization**, nullable (null for imported events)
- `external_provider_ref` — string, nullable (FLEX-003 — adapter-specific external ID)
- `status` — enum(`active`, `cancelled`) (FR-011)
- `created_at` — timestamp

**Relationships:** N—1 Category · N—1 Organization (nullable) · 1—N Match (rounds scoped to this event) · 1—N Listing (optional reference)

### 1.6 Category
Admin-managed lookup for classifying events and listings (FR-029).

- `id` — UUID, **PK**
- `name` — string, unique

**Relationships:** 1—N Event · 1—N Listing

### 1.7 Listing
A "looking for company" post created by a user (FR-021, FR-022, US-010).

- `id` — UUID, **PK**
- `user_id` — UUID, **FK → User** (author)
- `title` — string
- `description` — text
- `category_id` — UUID, **FK → Category**, nullable
- `event_id` — UUID, **FK → Event**, nullable (a listing may or may not point at a catalog event)
- `date_time` — timestamp, nullable
- `status` — enum(`active`, `removed_by_admin`) (FR-028)
- `created_at` — timestamp

**Relationships:** N—1 User (author) · N—1 Category (optional) · N—1 Event (optional) · 1—N Report (as target, when `target_type = listing`)

### 1.8 Match (Round)
Models both an open matching round and a resolved pairing for one event (US-009, UC-001, FR-016–FR-020, FR-023, FR-031). A round opens with `participant_b_id = null` while a candidate is sought (FR-018); once a candidate is found it becomes a proposal (FR-017) and resolves to mutual, declined, expired or withdrawn.

- `id` — UUID, **PK**
- `event_id` — UUID, **FK → Event**
- `participant_a_id` — UUID, **FK → User**
- `participant_b_id` — UUID, **FK → User**, nullable (null while waiting for a candidate)
- `per_event_answers_a` / `per_event_answers_b` — jsonb (per-participant answers from UC-001 step 3)
- `status` — enum(`waiting`, `proposed`, `accepted_a`, `accepted_b`, `mutual`, `declined`, `expired`, `withdrawn`, `merged`)
- `proposed_at` — timestamp, nullable
- `resolved_at` — timestamp, nullable

**Relationships:** N—1 Event · N—1 User (participant A) · N—1 User (participant B, nullable)
**Business rule (FUNC-002):** a user has at most one open `Match` per event. When a `waiting` row is paired, the candidate's own `waiting` row for that event is closed (`status = merged`) rather than left open.

### 1.9 Report
A complaint filed against a user profile or a listing (FR-025–FR-028, US-008).

- `id` — UUID, **PK**
- `reporter_id` — UUID, **FK → User**
- `target_type` — enum(`user`, `listing`)
- `target_id` — UUID, polymorphic **FK → User.id or Listing.id** (app-enforced, not a DB constraint), depending on `target_type`
- `reason` — string/enum
- `comment` — text, nullable
- `status` — enum(`open`, `reviewed`)
- `reviewed_by` — UUID, nullable, **FK → Administrator** (entity not yet modeled)
- `created_at` — timestamp

**Relationships:** N—1 User (reporter) · N—1 User or Listing (polymorphic target)
Repeated reports sharing the same `(target_type, target_id)` are grouped into one case by query (FR-026), not by a separate case table — kept simple for now; revisit if a case needs its own status.

### 1.10 DeviceToken
A device's push-notification registration, feeding FR-023/FR-024.

- `id` — UUID, **PK**
- `user_id` — UUID, **FK → User**
- `token` — string, unique
- `platform` — enum(`ios`, `android`, `web`)
- `created_at` — timestamp

**Relationships:** N—1 User

### 1.11 NotificationOutbox
Transactional outbox for reliably delivering push notifications (FR-011 event cancelled, FR-023 new match, FR-024 event reminder, FR-032 safety notice).

- `id` — UUID, **PK**
- `user_id` — UUID, **FK → User** (recipient)
- `type` — enum(`new_match`, `no_match_update`, `event_reminder`, `event_cancelled`, `safety_notice`, …)
- `payload` — jsonb
- `status` — enum(`pending`, `sent`, `failed`)
- `created_at` — timestamp
- `sent_at` — timestamp, nullable

**Relationships:** N—1 User (recipient)

## 2. Relationship Summary

| Relationship | Cardinality | Note |
|---|---|---|
| User — Profile | 1—1 | created at/after registration; may stay a draft (FR-004) |
| Profile — Interest | M—N | via `Profile_Interest` |
| Organization — Event | 1—N | nullable on Event (imported events have no organization) |
| Category — Event | 1—N | |
| Category — Listing | 1—N | optional |
| Event — Listing | 1—N | optional, a listing may not reference any event |
| User — Listing | 1—N | author |
| Event — Match | 1—N | rounds/proposals scoped to one event |
| User — Match | 1—N (×2) | as participant A and, separately, as participant B |
| User — Report | 1—N | as reporter |
| User/Listing — Report | 1—N | polymorphic target |
| User — DeviceToken | 1—N | |
| User — NotificationOutbox | 1—N | as recipient |

## 3. Sensitive Data (SEC-002 / SEC-003)

Per SEC-003, personal data other than passwords is encrypted at rest and in transit; per SEC-002, passwords are stored only as an `argon2id` hash. Fields flagged `*` above:

- `User.password_hash` — SEC-002 (hash only, never plaintext)
- `User.contact_identifier` — SEC-003
- `User.date_of_birth` — SEC-003
- `Profile.contact_link` — SEC-003, additionally access-gated by FR-019 (revealed only after mutual match)
- `Profile.photo_url` — personally identifying image data

## AI Usage Note
This document was written with the help of Claude, based on previously agreed-upon documentation files. It was reviewed and edited by Daryna Halytska.