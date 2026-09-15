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