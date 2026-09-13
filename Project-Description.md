## Project Idea Description

**Nearby** is an app for meeting new people and making friends, tied to real-world events happening around the city (movies, exhibitions, concerts, workshops, lectures, etc.). Unlike classic dating apps, where matching happens "in a vacuum," here the starting point is a specific event: a user picks an event they'd like to attend, specifies the format of communication they're looking for (new friends, dating, etc.) and their interests, and the system matches them with someone who has the highest overlap of interests and is also planning to attend that same event. This solves two problems at once: it's hard to find company to go to an interesting event with, and it's hard to meet people "in a void" without shared context or a reason to talk.

The app also includes a listings section, where users can post their own events or requests for company (e.g., "looking for company for an exhibition on Saturday"), expanding the event catalog.

## User Roles

| Role | Description |
|---|---|
| **User (Attendee)** | Registers, fills in a profile (age, interests, communication format), browses the event listings, picks an event, gets matched, sees the match's contact info to continue communication, posts listings. |
| **Organization/Venue** (e.g., a university like Mohyla Academy, a café, a cultural center) | Posts its own events directly in the app (without going through an external listing service), manages information about its events. |
| **Administrator** | Manages users (bans, reports), moderates listings and profiles, manages event category directories, oversees compliance with community rules. |

## Key Features

1. **Event Catalog** — browsing the city's event listings, obtained through integration with external services (Concert.ua, ArtWizard, etc.) and through direct posts from registered organizations/venues, with filtering by category, date, and location.
2. **User Profile** — age, description, photo, interests, communication format (friends / dating / company for an event).
3. **Event-Based Matching** — pick an event → the algorithm matches the user with the person who has the highest overlap of interests and has also picked that event.
4. **Contact Exchange After a Match** — after a successful match, users see each other's contact details/links to continue communication outside the app (no built-in messenger).
5. **Listings** — users can independently create posts like "looking for company / looking for friends for an event."
6. **Notifications** — reminders about new matches and the upcoming date of a chosen event.
7. **Reports and Moderation** — the ability to report a user/listing, handled by the administrator.

## Mini Design Document

### 1. System Purpose
Nearby helps people find company for attending cultural and entertainment events in their city, combining an event listing feature with matching companions/conversation partners by shared interests. The target audience is young people and adults who want to expand their social circle or don't have anyone to go to an interesting event with.

### 2. System Boundaries
**In scope for this semester:**
- User registration/authentication, profiles with interests.
- Event catalog populated through integration with external listing service(s) (Concert.ua, ArtWizard, etc.), as well as through direct posts from organizations/venues.
- A basic matching algorithm based on shared interests and the chosen event.
- Exchange of contact details between matched participants (no built-in messenger/chat inside the app).
- Listings section (creation, browsing, basic moderation).
- Administrator role with the ability to ban users/listings.

**Out of scope (deliberately not implemented this semester):**
- A built-in messenger/chat within the app — communication happens outside the system.
- Payments, ticket sales.
- Advanced AI-personalized recommendations (sophisticated machine learning algorithms).

### 3. User Roles and Permissions
- **User**: registration, profile editing, browsing events, picking an event to attend, receiving a match, viewing the match's contacts, creating/viewing listings, filing a report.
- **Organization/Venue**: registration as a legal entity/venue, posting its own events, editing/cancelling its own events.
- **Administrator**: user management (banning/unbanning), moderation of listings and reports, managing event categories, viewing basic statistics.

### 4. Key Features
(see the "Key Features" section above — 7 items)

### 5. Non-Functional Requirements
1. **Performance**: the event catalog page must load in ≤ 1 second for 100 concurrent users.
2. **Security/Privacy**: user passwords are never stored or transmitted in plain text — only in a securely hashed form.
3. **Reliability**: the matching algorithm must complete processing a request within no more than 3 seconds and correctly handle the case where no suitable match is found.
4. **Usability**: filling in a profile as a new user must take no more than 5 minutes (no more than 10 required fields).

### 6. Assumptions and Constraints
- Stack: a single TypeScript codebase across all layers — Expo (React Native) with Expo Router and NativeWind for the iOS, Android and web clients; NestJS with Prisma for the REST API; PostgreSQL for storage; argon2id + JWT for authentication; Expo Notifications for push; Docker for the local database and for deployment; GitHub Actions for CI.
- The event catalog is populated through integration with external service(s) and through direct posts from organizations/venues — the specific integration method (an official API, if available, or another data-retrieval method) will be clarified later, since a public API for these services is not yet confirmed.
- Communication between matched participants happens outside the app (via the exchanged contacts) — a built-in chat is not being developed.
- Team of 4 students, implementation timeline — one semester (11 weeks).