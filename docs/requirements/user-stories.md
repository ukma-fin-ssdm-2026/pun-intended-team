# User Stories

## Stories

### US-001: Organization posts an event

**As an** organization/venue
**I want to** post my own events
**so that** users browsing the event catalog can discover my event and find company to attend it.

**Acceptance Criteria:**

1. **Given:** I am logged in as a registered organization<br>
	**When:** I fill in the required event fields (title, category, date and time, location, description) and submit the form<br>
	**Then:** the event is published in the event catalog and can be found by users filtering by its category, date and location

2. **Given:** I am logged in as a registered organization and one of the required fields is empty<br>
	**When:** I submit the form<br>
	**Then:** the event is not published and I see a validation message pointing at the missing field

**INVEST check:**

- **Independent** - publishing an event depends only on organization accounts existing, not on profiles or matching.
- **Negotiable** - the exact set of required fields and whether posted events need moderation can be clarified with the team.
- **Valuable** - direct posts from organizations/venues are one of the two sources that fill the event catalog.
- **Estimable** - clear scope: event form + validation + saving to the database + display in the catalog.
- **Small** - a single form and one create endpoint.
- **Testable** - can be verified manually or with automated tests.

---

### US-002: Organization edits or cancels an event

**As an** organization/venue
**I want to** edit or cancel the events I posted
**so that** users always see up-to-date information and don't show up to an event that no longer takes place.

**Acceptance Criteria:**

1. **Given:** I am logged in as the organization that created the event and the event date has not passed<br>
	**When:** I change the event details and save, or mark the event as cancelled<br>
	**Then:** the catalog shows the updated details, or marks the event as cancelled, and users who picked this event are notified

**INVEST check:**

- **Independent** - works on an already existing event record and can be developed separately from the event catalog, user profiles and matching.
- **Negotiable** - whether cancelling removes the event or keeps it labelled "cancelled", and how users are notified, is open for discussion.
- **Valuable** - keeps users from travelling to an event that changed or no longer takes place.
- **Estimable** - update/cancel endpoints + an ownership check + a notification trigger.
- **Small** - reuses the create-event form and adds two actions on top of it.
- **Testable** - can be verified by changing an event and confirming the catalog is updated and the notification is sent.

---

### US-003: User fills in their profile

**As a** user,
**I want to** be able to fill in my profile (age, description, photo, interests, communication format),
**so that** the system can find me the best possible match.

**Acceptance Criteria:**

1. **Given:** the user is logging into the app for the first time<br>
	**When:** they fill in all required profile fields<br>
	**Then:** the system saves the profile and grants access to the event catalog

**INVEST check:**

- **Independent** - does not depend on other feature areas, which can be developed in parallel.
- **Negotiable** - the exact list of fields and UI can be clarified with the team.
- **Valuable** - matching is impossible without a profile.
- **Estimable** - the scope is clear: form + validation + saving to the database.
- **Small** - narrowly scoped (a single form with a fixed field set).
- **Testable** - can be verified manually (fill in the form, confirm the data is saved correctly) or with automated tests.

---

### US-004: User browses and filters the event catalog

**As a** user,
**I want to** browse and filter the event catalog by category, date and location,
**so that** I can find an event I'm interested in.

**Acceptance Criteria:**

1. **Given:** the user is logged in<br>
	**When:** they open the event catalog<br>
	**Then:** they see a list of upcoming events with their title, category, date and location.

2. **Given:** the user is on the event catalog page<br>
	**When:** they apply a filter by category, date, or location<br>
	**Then:** only events matching the selected filter(s) are shown

**INVEST check:**

- **Independent** - the catalog can be shown even without a filled-in profile or matching.
- **Negotiable** - the set of filters (category/date/location) can be expanded.
- **Valuable** - this is the entry point for the user into all event-matching functionality.
- **Estimable** - there is a clear input (request + filters) and output (list of events or empty result).
- **Small** - implemented as a single API endpoint with filter parameters + catalog page.
- **Testable** - there are concrete Given/When/Then scenarios, including the edge case of an empty catalog or no events matching the applied filters.

---

### US-005: Administrator bans user
**As an** administrator
**I want to** ban user if necessary
**so that** I can control misbehavior of app users

**Acceptance Criteria:**
1. **Given:** I am logged as administrator and see a report about a user<br>
	**When:** I review it and click "Ban"<br>
	**Then:** user can't access app and their account is disabled

**INVEST check:**

- **Independent** - moderation acts on existing accounts and does not block any other feature area.
- **Negotiable** - whether the ban is permanent or temporary, and whether the user is told the reason, can be clarified with the team.
- **Valuable** - without it there is no way to stop a user who breaks the community rules.
- **Estimable** - one admin action: a status flag on the account + an access check on login.
- **Small** - a single action in the moderation queue.
- **Testable** - ban a test account and confirm it can no longer log in or access protected pages.

---

### US-006: Administrator bans listing
**As an** administrator
**I want to** ban listings if necessary
**so that** I can protect users from scam

**Acceptance Criteria:**
1. **Given:** I am logged in as administrator and see a report about listing<br>
	**When:** I review it and click "Delete"<br>
	**Then:** listing is deleted from catalog

**INVEST check:**

- **Independent** - operates on listings only and can be developed in parallel with banning users.
- **Negotiable** - deleting the listing versus hiding it, and whether the author is notified, is open for discussion.
- **Valuable** - protects users from scam and rule-breaking posts in the listings section.
- **Estimable** - one admin action on the listing record + its removal from the catalog.
- **Small** - a single action on a single entity.
- **Testable** - report a test listing, delete it, and confirm it no longer appears in the catalog.

---

### US-007: User finds nearby events on a map

**As a** user,
**I want to** open a map of my city and see the venues/places hosting events,
**so that** I can find an event that is closest to my current location.

**Acceptance Criteria:**

1. **Given:** the user is logged in and has granted access to their location<br>
	**When:** they open the map view of the event catalog<br>
	**Then:** the map is centred on their current location and shows pins for the venues that host upcoming events

2. **Given:** the user is on the map view<br>
	**When:** they tap a venue pin<br>
	**Then:** they see the upcoming events at that venue and can open an event to pick it

3. **Given:** the user has denied access to their location<br>
	**When:** they open the map view<br>
	**Then:** the map is centred on the default city view and still shows all venue pins

**INVEST check:**

- **Independent** - it is another way of presenting the same catalog data and does not depend on matching or profiles.
- **Negotiable** - the map provider, the default city, and whether the catalog filters also apply to the map can be clarified with the team.
- **Valuable** - location is one of the main reasons a user picks one event over another.
- **Estimable** - clear scope: a map component + venue coordinates + a pin details view.
- **Small** - one screen built on top of the existing catalog data.
- **Testable** - can be tested manually or automatically by following the Given/When/Then scenarios.

---

### US-008: User reports another user's misbehavior

**As a** user,
**I want to** report the misbehavior of another user,
**so that** the administrator can review it and the platform stays safe for everyone.

**Acceptance Criteria:**

1. **Given:** the user is logged in and is viewing another user's profile<br>
	**When:** they select "Report", choose a reason and submit it<br>
	**Then:** the report is saved, appears in the administrator's moderation queue, and the user sees a confirmation that it was sent

2. **Given:** the user has already reported the same profile<br>
	**When:** they report it again, adding details they had left out the first time<br>
	**Then:** the new report is saved as well and grouped with the earlier ones into a single case for that profile, so the administrator sees the full history and the number of reports in one place

**INVEST check:**

- **Independent** - the report can be created and stored without the moderation actions from US-005 and US-006 being implemented yet.
- **Negotiable** - the list of reasons, the free-text comment, and whether the reporter is told the outcome can be clarified with the team.
- **Valuable** - without reports the administrator has no way of learning about misbehavior.
- **Estimable** - clear scope: a report form + saving to the database + display in the moderation queue.
- **Small** - a single form available from a profile and a listing.
- **Testable** - can be tested manually or automatically by following the Given/When/Then scenarios.
