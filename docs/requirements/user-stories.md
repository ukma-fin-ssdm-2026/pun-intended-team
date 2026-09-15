# User Stories

## Stories

- US-001
As an organization/venue
I want to post my own events
so that users browsing the event catalog can discover my event and find company to attend it.

Acceptance Criteria:

    Given: I am logged in as a registered organization
    When: I fill in the required event fields (title, category, date and time, location, description) and submit the form
    Then: the event is published in the event catalog and can be found by users filtering by its category, date and location

    Given: I am logged in as a registered organization and one of the required fields is empty
    When: I submit the form
    Then: the event is not published and I see a validation message pointing at the missing field


- US-002
As an organization/venue
I want to edit or cancel the events I posted
so that users always see up-to-date information and don't show up to an event that no longer takes place.

Acceptance Criteria:

    Given: I am logged in as the organization that created the event and the event date has not passed
    When: I change the event details and save, or mark the event as cancelled
    Then: the catalog shows the updated details, or marks the event as cancelled, and users who picked this event are notified

- US-003: As a user, I want to be able to fill in my profile (age, description, photo, interests, communication format), so that the system can find me the best possible match.
  - Acceptance Criteria:
    - [ ] Given the user is logging into the app for the first time, when they fill in all required profile fields, then the system saves the profile and grants access to the event catalog.
    - [ ] ...

- US-004: As a user, I want to browse the event catalog, so that I can find an event I'm interested in.
- Acceptance Criteria:
    - [ ] Given the user is logged in, when they open the event catalog, then they see a list of upcoming events with their title, category, date and location.

**US-003**
- Independent - yes, implemented as a standalone profile form, does not depend on other stories.
- Negotiable - yes, the exact list of fields and UI can be clarified with the team.
- Valuable - yes, matching is impossible without a profile.
- Estimable - yes, the scope is clear: form + validation + saving to the database.
- Small - yes, fits within one lab/sprint.
- Testable - yes, the acceptance criteria can be verified manually or with a form automated test.

**US-004**
- Independent - yes, the catalog can be shown even without a filled-in profile or matching.
- Negotiable - yes, the set of filters (category/date/location) can be expanded.
- Valuable - yes, this is the entry point for the user into all event-matching functionality.
- Estimable - yes, there is a clear input (request) and output (list of events or empty result).
- Small - yes, implemented as a single API endpoint + catalog page.
- Testable - yes, there are concrete Given/When/Then scenarios, including the edge case (0 results, 100 users).