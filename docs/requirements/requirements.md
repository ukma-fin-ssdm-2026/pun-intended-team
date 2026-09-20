# System Requirements

## 1. Purpose and Scope
Briefly: what this product is, who it's for, what is out of scope for this version.

## 2. Glossary
- Term A – definition
- Term B – definition

## 3. Functional Requirements (FR)
**Registration & Profile**
- FR-001: The system shall allow a user to register an account and authenticate on subsequent visits.
- FR-002: The system shall allow a user to create and edit a profile, including age, description, photo, interests, and desired communication format (friends / dating / company for an event). (US-003)
- FR-003: The system shall allow an organization/venue to register as a legal entity/venue account.
**Event Catalog**
- FR-004: The system shall display a catalog of upcoming events to a logged-in user. (US-004)
- FR-005: The system shall allow a user to filter the event catalog by category, date, and location. (US-004)
- FR-006: The system shall populate the event catalog with events retrieved from external listing services (e.g., Concert.ua, ArtWizard) in addition to direct organization posts.
- FR-007: The system shall allow an organization to create and publish an event with title, category, date/time, location, and description. (US-001)
- FR-008: The system shall validate all required event fields before publishing and display an error identifying any missing field. (US-001)
- FR-009: The system shall allow an organization to edit or cancel an event it created and notify users who had selected that event. (US-002)
- FR-010: The system shall display a map with pins for venues hosting upcoming events, centered on the user's location (or a default city view if location access is denied). (US-007)
- FR-011: The system shall show a venue's upcoming events when its map pin is tapped and allow the user to select one. (US-007)
**Matching**
- FR-012: The system shall allow a user to select an event they intend to attend. (US-009)
- FR-013: The system shall match a user with another user who selected the same event, prioritizing the highest overlap of stated interests. (US-009)
- FR-014: The system shall correctly handle the case where no suitable match is found, without error. (US-009)
- FR-015: The system shall reveal each matched participant's contact details to the other only after a successful match. (US-009)
**Listings**
- FR-016: The system shall allow a user to create a listing (e.g., "looking for company for an event"). (US-010)
- FR-017: The system shall allow a user to browse existing listings.
**Notifications**
- FR-018: The system shall notify a user when they receive a new match.
- FR-019: The system shall send a reminder notification ahead of the date of an event the user selected.
**Reporting & Moderation**
- FR-020: The system shall allow a user to report another user's profile, selecting a reason and optionally a comment. (US-008)
- FR-021: The system shall group repeated reports on the same profile into a single case visible to administrators, with a report count. (US-008)
- FR-022: The system shall allow an administrator to review a report and ban the reported user, revoking their app access. (US-005)
- FR-023: The system shall allow an administrator to review a reported listing and delete it from the catalog. (US-006)
- FR-024: The system shall allow an administrator to manage the directory of event categories.
- FR-025: The system shall allow an administrator to view basic platform statistics (e.g., number of users, events, matches, and open reports).
**Event Participation**
- FR-026: The system shall allow a user to withdraw from an event they previously selected before a match occurs, removing them from that event's matching pool.

## 4. Non-Functional Requirements (NFR)
- PORT-001 (Portability): The application must share at least 90% of its codebase across iOS, Android, and Web platforms, without requiring platform-specific code.
- SEC-001 (Security): User contact details (such as phone number, links, etc.) are revealed to the other participant only after a successful match. Attempting to access information marked as hidden without the match results in blocking in 100% of test cases (HTTP 403). Data transmission also occurs over a channel encrypted with TLS 1.2+.
- USA-001 (Usability): A new user must understand the app's purpose and how to join an event within the first 30 seconds.

## 5. Assumptions and Constraints
- A-001: ...
- C-001: ...

## 6. Risks and Open Questions
- R-001: ...
- OQ-001: ...
