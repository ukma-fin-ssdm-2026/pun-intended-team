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

---

### US-002: Organization edits or cancels an event

**As an** organization/venue
**I want to** edit or cancel the events I posted
**so that** users always see up-to-date information and don't show up to an event that no longer takes place.

**Acceptance Criteria:**

1. **Given:** I am logged in as the organization that created the event and the event date has not passed<br>
	**When:** I change the event details and save, or mark the event as cancelled<br>
	**Then:** the catalog shows the updated details, or marks the event as cancelled, and users who picked this event are notified

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