# System Requirements

## 1. Purpose and Scope
**Nearby** is an app for meeting new people and making friends, tied to real-world events happening around the city. The target audience is people aged 18–30. A user fills in a profile, picks an event from the catalog, and is matched with another attendee who shares their interests. Organizations and venues publish their events to the same catalog.

For this version the scope is Kyiv only, the interface ships in Ukrainian, and the app ends at the contact exchange — arranging and attending the meeting happens outside of it.

## 2. Glossary

**Product terms**
- **Event** — a single happening in the catalog: a concert, exhibition, lecture, workshop, film screening and so on. Carries a title, category, date and time, location and description. Events reach the catalog two ways: posted by an organization or imported from an external provider.
- **Event catalog** — the browsable, filterable set of upcoming events; the first screen a user sees.
- **Category** — the kind of event, used for filtering.
- **Organization** — a venue or event organizer with an account that posts and manages its own events. Organizations do not take part in matching.
- **User** — an individual with a profile who browses events, requests matches and may post listings. Must be 18 or older.
- **Profile** — the personal information a user gives so they can be matched.
- **Listing** — a "looking for company" post a user writes, describing an event or activity they want company for. It may point at an event in the catalog but doesn't need to: a listing can propose something the catalog does not cover. Listings can be reported and removed by an administrator.
- **Match** — a proposed pairing of two users attending the same event. A match becomes mutual when both sides accept.
- **Candidate** — a user who may be proposed to another in a round, once the exclusions have been applied.
- **Administrator** — a moderator account: bans users, removes listings and works the report queue.
- **Report** — a complaint one user files about another user or a listing, which reaches the moderation queue within a minute.

**Requirement terms**
- **Fit criterion** — the value or condition that decides whether a requirement passes or fails.
- **Verification** — how that value is obtained: the test, measurement or review that produces it.
- **pNN** — percentile notation. `p95 ≤ 1000 ms` means 95% of measurements are at or below 1000 ms, and says nothing about the slowest 5%.

**External standards**
- **ISO/IEC 25010:2023** — the product quality model whose nine characteristics organize §4.
- **OWASP** — Open Worldwide Application Security Project, the non-profit that publishes the security guidance cited in SEC-002 and SEC-006.
- **ASVS** — Application Security Verification Standard, OWASP's checklist of security controls. **Level 1** is its baseline tier, the one SEC-006 commits to.
- **TLS** — Transport Layer Security, the encryption protecting traffic between app and API (SEC-001).

## 3. Functional Requirements (FR)
**Registration & Profile**
- FR-001: The system shall allow a user to register an account and authenticate on subsequent visits.
- FR-002: The system shall allow a user to create and edit a profile, including age, description, photo, interests, and desired communication format (friends / dating / company for an event). (US-003)
- FR-003: The system shall allow an organization/venue to register as a legal entity/venue account.
- FR-004: A profile in progress shall be saved when the user leaves the screen and restored when they return. (US-003)
- FR-005: Registration is verified by a code delivered over Telegram or SMS: the system sends a code to the contact given at registration and activates the account once the user enters it.

**Event Catalog**
- FR-006: The system shall display a catalog of upcoming events to any visitor, whether or not they are logged in. (US-004)
- FR-007: The system shall allow a user to filter the event catalog by category, date, and location. (US-004)
- FR-008: The system shall populate the event catalog with events retrieved from external listing services (e.g., Concert.ua, ArtWizard) in addition to direct organization posts.
- FR-009: The system shall allow an organization to create and publish an event with title, category, date/time, location, and description. (US-001)
- FR-010: The system shall validate all required event fields before publishing and display an error identifying any missing field. (US-001)
- FR-011: The system shall allow an organization to edit or cancel an event it created and notify users who had selected that event. (US-002)
- FR-012: The system shall display a map with pins for venues hosting upcoming events, centered on the user's location (or a default city view if location access is denied). (US-007)
- FR-013: The system shall show a venue's upcoming events when its map pin is tapped and allow the user to select one. (US-007)
- FR-014: When the catalog is serving data from a failed import cycle, the system shall display a "last updated …" notice.
- FR-015: Records from an external provider that cannot be mapped to our event model shall be skipped and logged.

**Matching**
- FR-016: The system shall allow a user to select an event they intend to attend. (US-009)
- FR-017: The system shall match a user with another user who selected the same event, prioritizing the highest overlap of stated interests. (US-009)
- FR-018: The system shall correctly handle the case where no suitable match is currently available, without error, and let the user choose to keep waiting in the pool, select a different event (FR-016), or create a listing (FR-021). (US-009)
- FR-019: The system shall show each proposed match only the other participant's profile, without contact details; contact details shall be revealed to both participants only after both have explicitly approved the match, and shall not be revealed if either participant declines. (US-009)
- FR-020: The matching algorithm shall exclude from a user's candidate set the user themselves, banned accounts, users they have reported, and candidates they have declined. If exclusion empties the set, FR-018 applies. (US-009)

**Listings**
- FR-021: The system shall allow a user to create a listing (e.g., "looking for company for an event"). (US-010)
- FR-022: The system shall allow a user to browse existing listings. (US-010)

**Notifications**
- FR-023: The system shall notify a user when they receive a new match. (US-009)
- FR-024: The system shall send a reminder notification ahead of the date of an event the user selected.

**Reporting & Moderation**
- FR-025: The system shall allow a user to report another user's profile, selecting a reason and optionally a comment. (US-008)
- FR-026: The system shall group repeated reports on the same profile into a single case visible to administrators, with a report count. (US-008)
- FR-027: The system shall allow an administrator to review a report and ban the reported user, revoking their app access. (US-005)
- FR-028: The system shall allow an administrator to review a reported listing and delete it from the catalog. (US-006)
- FR-029: The system shall allow an administrator to manage the directory of event categories. Changes take effect without a code change or a deployment and appear in the catalog filters immediately.
- FR-030: The system shall allow an administrator to view basic platform statistics (e.g., number of users, events, matches, and open reports).

**Event Participation**
- FR-031: The system shall allow a user to withdraw from an event they previously selected before a match occurs, removing them from that event's matching pool. (US-009)

**Safety**
- FR-032: On a user's first match the system shall show a safety notice — meet in a public place, tell someone where you are going, how to report — with an acknowledgment control. The notice remains reachable from the profile afterwards.

**Platform Support**
- FR-033: On a device or browser outside the supported set, the app shall display an unsupported-version notice instead of loading normally.

## 4. Non-Functional Requirements (NFR)

Quality attributes follow the **ISO/IEC 25010:2023** product quality model.

### 4.1 Performance Efficiency

**PERF-001**
The API shall answer read requests under the expected peak load of 500 concurrent sessions within a bounded response time, so that no screen blocks on the network.
- *Fit criterion:* server-side response time p95 ≤ 1000 ms, p99 ≤ 2000 ms, maximum ≤ 5000 ms.
- *Verification:* k6 scenario against staging at 500 concurrent sessions for 10 minutes, run in CI before the final demo.

**PERF-002**
The event catalog shall render its first page of events within one second of being opened, for 100 concurrent users on a 10 Mbit/s connection.
- *Fit criterion:* p95 ≤ 1000 ms from opening the catalog to the titles, dates and locations of the first 20 events being visible; images may still be loading.
- *Verification:* Largest Contentful Paint for the catalog route, recorded by a Lighthouse / Expo trace under the PERF-001 load scenario at 100 concurrent users.

**PERF-003**
The system shall deliver the outcome of a match request — FR-018 — within one minute of the request, so that a user is never left waiting without an answer.
- *Fit criterion:* p90 of request-to-outcome time ≤ 60 s with 50 users requesting a match on the same event.
- *Verification:* load scenario with 50 virtual users requesting a match on one event inside a ten-second window, asserting p90 of request-to-outcome time.

**PERF-004**
The mobile app shall start and stay responsive to touch input on a mid-range device, not only on a flagship.
- *Fit criterion:* cold start to an interactive screen ≤ 3 s on a device with 4 GB RAM; no single JavaScript task blocks the main thread for more than 200 ms.
- *Verification:* Expo / React Native performance monitor on a physical mid-range Android device, on the catalog, profile and matching screens.

### 4.2 Reliability

**REL-001**
The service shall be available to users outside maintenance windows announced in advance.
- *Fit criterion:* monthly uptime ≥ 99% on `/health`, excluding maintenance announced at least 24 h ahead and totalling no more than 2 h per month.
- *Verification:* external uptime monitor polling `/health` every 5 minutes.

**REL-002**
Every screen that waits on the network shall show a loading state, and every failed request shall show an error message with a way out, so that no action leaves the user on a blank or frozen screen.
- *Fit criterion:* all four states — loading, empty, error, success — implemented on every network-dependent screen; a failed or timed-out request produces a visible error with a working **Retry** within 10 s; zero open defects of class "unrecoverable UI state" at release.
- *Verification:* manual pass with the network offline and throttled to 3G on every screen, plus automated tests that mock a 500 response and assert the error state renders.

**REL-003**
The catalog shall keep serving previously imported events while the external event listing service is unreachable.
- *Fit criterion:* with the external integration failing or timing out, the catalog serves the last successfully imported events — shown as not current by FR-014 — and the client receives no `5xx` in 100% of such cases.
- *Verification:* integration test with the provider adapter stubbed to fail, asserting a 200 response.

**REL-004**
The system shall be restorable from automated backups after loss of the database, with bounded data loss and bounded downtime.
- *Fit criterion:* daily PostgreSQL backup with 7 daily and 4 weekly copies retained and older copies deleted automatically; a restore loses at most 24 hours of data and takes at most 4 hours to bring the service back.
- *Verification:* confirm the retention setting on the managed Postgres host; one restore drill into a scratch database during the semester, with date and outcome recorded in the repo.

### 4.3 Security

**SEC-001**
The system shall enforce the mutual-acceptance rule server-side and transmit contact details only over an encrypted channel, so that the rule cannot be bypassed by calling the API directly.
- *Fit criterion:* a contact request in any state other than two recorded acceptances is refused with `403` in 100% of cases, including calls that skip the UI and calls from unauthenticated or banned users. All traffic over TLS 1.2+; plain HTTP is redirected, never served.
- *Verification:* authorization tests over each match state (proposed, one-sided accept, mutual accept, rejected) and as an unauthenticated and a banned user; TLS configuration checked with an SSL scanner.

**SEC-002**
Passwords shall be stored and transmitted only as a modern slow hash, and shall never appear in logs or API responses.
- *Fit criterion:* `argon2id` at OWASP-recommended parameters or stronger — memory ≥ 19 MiB, iterations ≥ 2, parallelism ≥ 1, unique per-user salt; zero endpoints returning a password field and zero log lines containing one.
- *Verification:* inspect the users table for the hash format; test that scans every API response schema and the captured log output for password fields.

**SEC-003**
Personal data other than passwords — phone numbers, contact links, dates of birth — shall be encrypted at rest as well as in transit.
- *Fit criterion:* the database volume is encrypted at rest; contact identifiers are additionally encrypted at column level with keys held outside the repository; zero secrets or keys committed to git.
- *Verification:* read raw column values from a database dump and confirm they are unreadable; GitHub secret scanning plus a secret scan on every push in CI.

**SEC-004**
The system shall log every security-relevant action with enough detail to reconstruct who did what and when, without the log becoming a second copy of the personal data.
- *Fit criterion:* logged events — successful and failed sign-in, password change, contact reveal, report filed, ban, unban, every admin action. Each record carries timestamp, actor ID, action, target and result. Retention ≥ 90 days. Zero passwords, tokens or full contact details in log output.
- *Verification:* test that performs each listed action and asserts a matching log record; scan of sample log output for forbidden fields.

**SEC-005**
Sessions shall expire without user action, and access shall be withdrawn on sign-out or ban immediately rather than at token expiry, while renewal stays invisible to the user.
- *Fit criterion:* access tokens valid ≤ 60 min; refresh tokens ≤ 30 days, revoked on sign-out and on ban; protected endpoints reject a missing, expired, tampered or revoked token with `401` in 100% of cases; no re-authentication is required within 30 days of activity.
- *Verification:* auth test suite covering the four bad-token cases; test that bans an account mid-session and asserts the next request is rejected.

**SEC-006**
The application shall meet a named published security baseline and ship free of known high-severity dependency advisories.
- *Fit criterion:* all applicable OWASP ASVS v5 **Level 1** controls pass, each exception written down and justified; zero Critical and zero High `npm audit` advisories at release.
- *Verification:* ASVS L1 checklist reviewed and signed off in the repo; `npm audit --audit-level=high` as a CI gate.

**SEC-007**
The system shall rate-limit sign-in attempts and public endpoint requests, so that credentials cannot be guessed and the catalog cannot be scraped by brute force.
- *Fit criterion:* after 5 failed sign-ins for one account within 15 min, further attempts are refused for 15 min; public endpoints cap at 100 requests/min per IP, returning `429`; failure messages do not reveal whether an account exists.
- *Verification:* test firing six bad sign-ins and asserting the lockout; test exceeding the per-IP cap and asserting `429`; message wording reviewed for account enumeration.
- *Note:* written for password sign-in; the same limits apply to verification-code attempts and resends if we go passwordless.

**SEC-008**
A registration verification code — FR-005 — shall be short-lived, single-use and attempt-limited, and shall be handed to the messaging provider within a bounded time.
- *Fit criterion:* 6-digit code, valid 10 min, usable once, invalidated after 3 failed attempts, at most 1 resend per minute; p95 of the time from request to the code reaching the provider ≤ 2 s. Delivery time from the provider to the device is out of scope — it depends on the carrier and cannot be measured by us.
- *Verification:* tests for expiry, reuse, attempt limit and resend throttle; p95 dispatch latency measured from our own logs.

### 4.4 Interaction Capability

**INTC-001**
A first-time user shall be able to state what the app is for and locate the action that selects an event within 30 seconds of opening it, without explanation from the team.
- *Fit criterion:* at least 4 of 5 first-time users succeed at both within 30 s, unaided.
- *Verification:* moderated first-impression test with five people outside the team, recording success and wording per participant.

**INTC-002**
A first-time user shall be able to complete a profile within five minutes.
- *Fit criterion:* at most 10 required fields; at least 4 of 5 first-time users complete the profile in ≤ 5 min unaided.
- *Verification:* timed task in the INTC-001 usability session; field count checked against the profile schema.

**INTC-003**
Any action that cannot be undone shall require explicit confirmation naming its consequence, and a form rejected by validation shall preserve what the user already entered.
- *Fit criterion:* 100% of irreversible actions — currently cancelling an event, deleting a listing, banning a user and revealing contacts — present a confirmation naming the consequence.
- *Verification:* UI tests submitting each form with one invalid field and asserting the other values survive; manual checklist over every irreversible action in the build.

**INTC-004**
Every message the user sees shall name what happened and what they can do next, in ordinary language.
- *Fit criterion:* 100% of user-facing error states name the problem and the next step; zero raw status codes, exception names or stack traces reach the screen. Technical detail goes to the log under SEC-004.
- *Verification:* review of the error-message catalogue before release, plus a test asserting that an unhandled server error renders the generic state rather than the exception text.

### 4.5 Maintainability

**MAIN-001**
The API shall carry enough automated tests that a change breaking something else is caught before review rather than after merge.
- *Fit criterion:* statement coverage ≥ 70% on the NestJS API, and ≥ 85% on the matching service, the authorization guards and the report/ban flow.
- *Verification:* coverage report produced by the test job on every pull request; the threshold is configured in the test runner as a failing gate, not checked by eye.

### 4.6 Flexibility

**FLEX-001**
The codebase shall be shared across iOS, Android and web, and the layout shall adapt from phone to desktop width, so that a feature is built once rather than three times.
- *Fit criterion:* ≥ 90% of application source lines live outside platform-specific files (`*.ios.tsx`, `*.android.tsx`, `*.web.tsx`, native directories); the layout works from 320 px to 1920 px with no horizontal scrolling or clipped content.
- *Verification:* line-count script over the source tree, reported in the README; responsive check at 320, 768 and 1920 px.

**FLEX-002**
The API shall hold no session or request state in memory, so that a second instance can be started without a code change.
- *Fit criterion:* zero in-memory sessions or request-scoped caches that a second instance would not see; 2 instances behind a load balancer pass the full test suite with zero failures attributable to instance affinity.
- *Verification:* run two API containers behind a round-robin proxy and execute the integration suite against the proxy.

**FLEX-003**
Adding or replacing an external event provider shall be confined to a single adapter, since it is not yet known whether Concert.ua or ArtWizard will give us an API.
- *Fit criterion:* every provider sits behind one adapter interface; adding or replacing one changes only that adapter and its configuration, with zero changes in catalog, matching or UI code; imported records are normalized into our own event model.
- *Verification:* write a second stub adapter and confirm the catalog serves it with no changes outside the adapter directory.

### 4.7 Compatibility

**COMP-001**
The system shall support a stated set of devices and browsers.
- *Fit criterion:* iOS 15+, Android 10+, and the last two major versions of Chrome, Safari, Firefox and Edge; all core flows pass on every listed target; anything outside it is handled by FR-033.
- *Verification:* manual smoke pass of the core flows on one device or browser per listed target before the final demo.

### 4.8 Functional Suitability

**FUNC-001**
The matching algorithm shall return a reproducible ordering for a given candidate set and seed, so that any result can be replayed and explained, while varying between users and sessions in production.
- *Fit criterion:* identical ordering across 10 consecutive runs for the same candidate set and seed; two different seeds produce different orderings; the seed varies per user and session in production; ties are broken by a stated rule, not by database order.
- *Verification:* unit test over a seeded fixture asserting identical output across runs; second test with two seeds asserting the orderings differ.

**FUNC-002**
A pairing shall be exclusive and mutual: each user appears in at most one pairing per round, and a paired user is not offered to anyone else until that match is rejected or expires.
- *Fit criterion:* zero cases of A → B without B → A; zero users appearing in two pairings of one round; holds in 100% of test cases, including users filing at different times within one round and the same user filing on several events at once.
- *Verification:* property test over randomly generated rounds asserting the result is a valid matching; concurrency test firing overlapping requests that all rank the same candidate first, asserting exactly one of them receives that candidate.

### 4.9 Safety

**SAFE-001**
Registration shall require a date of birth and shall refuse applicants below the minimum age.
- *Fit criterion:* applicants under 18 are refused in 100% of cases, including attempts that call the API directly; age is computed server-side, never trusted from the client.
- *Verification:* boundary tests one day under, exactly on, and one day over the threshold, executed against the API rather than the form.

**SAFE-002**
Contact details shall not be released to a user until they have acknowledged the first-match safety notice — FR-032.
- *Fit criterion:* contacts are withheld in 100% of first matches until an acknowledgment is recorded, including requests that call the API directly.
- *Verification:* UI test on a freshly created account, plus an API call attempting a contact reveal before acknowledgment.

**SAFE-003**
Reporting shall be reachable from every screen that shows another user, and a submitted report shall reach a moderator within one minute.
- *Fit criterion:* **Report** reachable in ≤ 2 taps from any profile, listing or match screen; the report appears in the moderation queue within 60 s and the reporter receives a confirmation; repeat reports on one profile group into a single case, as US-008 requires.
- *Verification:* tap-count check on each of the three screens, plus an end-to-end test from submission to the report appearing in the admin queue.

## 5. Assumptions and Constraints

**Assumptions**
- **A-001:** Peak load is 500 concurrent active sessions, mostly browsing the catalog. Affects PERF-001, PERF-003.
- **A-002:** Enough users pick the same event for matching to find pairs.

**Constraints**
- **C-001:** No Russian language in the product, and no dependency, service or tool of Russian origin. Not negotiable against convenience.
- **C-002:** Scope for this trimester is events and users in Kyiv only.
- **C-003:** The interface ships in Ukrainian.
- **C-004:** Tech stack: React Native / Expo client, NestJS API, Prisma, PostgreSQL.

## 6. Risks and Open Questions

**Risks**
- **R-001:** No external provider grants an API, leaving the catalog dependent on organizations posting and web scraping (FLEX-003).
- **R-002:** Too few users per event for matching to produce pairs (FR-018).
- **R-003:** Hosting does not sustain the uptime target (REL-001).

**Open questions**
- **OQ-001: How do people sign in?** Password, email, or a Telegram/SMS code. Affects FR-005, SEC-002, SEC-005, SEC-007, SEC-008.
- **OQ-002: How long do we keep the audit log?** As for now - 90 days. Affects SEC-004.
- **OQ-003: How long does a declined candidate stay excluded?**
- **OQ-004: How long does a match proposal stay open before it expires?** Affects UC-001 (A4).

## AI Usage Note
This document was written with the participation of Claude.

**§2, §4, §5 and §6** are AI-generated wording, reviewed, edited and cut back by Viktoriia Baran. The non-functional requirements were rewritten from team notes into a uniform statement / fit criterion / verification form; the glossary, assumptions, constraints, risks and open questions were drafted from the rest of the document and then cut back manually to the project's actual scope.

**§3** — FR-004, FR-005, FR-014, FR-015, FR-020, FR-032, FR-033 and the final sentence of FR-029 are AI-generated: they were extracted from §4 during the NFR review, where they had been recorded as qualities although they describe behaviour. FR-030 (admin statistics) and FR-031 (withdrawing from an event before a match) were suggested by Claude after a review of Project-Description.md surfaced them as missing from the initial functional requirements list, and were confirmed by Oleh. The rest of §3 reflects the feature scope and matching/listing behaviour defined by Oleh Moshenskyi from Project-Description.md and team discussion. Claude assisted with formalizing each feature into a numbered "shall" statement, grouping the list into subsections, and cross-checking it against user-stories.md for consistency. The final list was reviewed and edited by Oleh.
