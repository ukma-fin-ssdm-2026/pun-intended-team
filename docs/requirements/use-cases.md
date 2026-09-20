# Use Cases

## UC-001: User gets matched with company for an event

**Related User Story:** US-009

| | |
|---|---|
| **Primary Actor** | User (registered, with a filled-in profile) |
| **Supporting Actor** | The matched participant — another user who has requested a match for the same event |
| **Goal** | Attend a chosen event together with another user who shares their interests and is looking for the same kind of company |
| **Preconditions** | The user is authenticated (FR-001); the user's profile contains interests and what they are looking for (FR-002); the event is published in the catalog and its date has not passed (FR-006) |
| **Postconditions** | The user is matched with exactly one other participant of the same event, both participants have accepted the match, and each of them sees the other's contact details (FR-019); both are notified (FR-023). If no match is confirmed, no contact details are revealed to either participant, and the user remains in the event's matching pool — unless they withdrew (A5), the event was cancelled (E2) or an account was banned (E3). |

**Main Success Scenario:**

1. The user opens an event from the catalog or from the map.
2. The user taps "Find me a match" on the event page.
3. The system asks the questions that apply to this particular event: what kind of company the user is looking for here (casual company for the evening, new friends, dating), whether they are open to extending the meeting beyond the event itself (a walk, coffee, dinner), and the remaining per-event preferences. The user answers and continues.
4. The system shows a confirmation screen explaining what happens next — the user will be matched with one of the other people who chose to attend this event, the two of them will first see each other's profiles, and contact details will only be exchanged once both have accepted. The screen offers a "Find me a match" control that confirms the request, and a control to not show this explanation again. The user confirms.
5. The system adds the user to the matching pool for that event together with the answers from step 3 (FR-016).
6. The system opens a matching round for the user and builds the candidate set from the other users in the pool, excluding the user themselves, banned accounts, users they have reported and candidates they have declined (FR-020).
7. The system ranks the candidates by the overlap of stated interests and the compatibility of the per-event answers, and picks the highest-scoring one (FR-017).
8. The system proposes the match to both participants and notifies them (FR-023). Each of them sees the other's profile — interests, what they are looking for at this event and the rest of the public profile — without any contact details. Neither is offered to anyone else while the proposal is pending (FUNC-002).
9. The user accepts the proposed match. Until the other participant responds, the user sees the match as pending.
10. The matched participant accepts the proposal as well.
11. The system closes the round as successful, reveals each participant's contact details to the other (FR-019) and notifies both of them (FR-023).
12. If this is the user's first match, the system shows the safety notice and waits for the user to acknowledge it (FR-032).
13. The user contacts their match and attends the event together with them.

**Alternative Flows & Exceptions:**

- **A1 (explanation suppressed):** at step 4 the user has previously asked not to see the explanation again. The system skips the confirmation screen and continues at step 5; the explanation stays reachable from the profile.
- **A2 (no candidates yet):** at step 6 the candidate set is empty. The system closes the round without a proposal, tells the user that no match has been found yet and keeps them in the pool for that event (FR-018). A new round opens for the user when another user joins the pool for this event, and the scenario resumes at step 6.
- **A3 (participant declines):** at step 9 or 10 either participant declines the proposal. The system closes the round without revealing any contact details, excludes the two from each other's candidate sets for this event (FR-020) and returns both to the pool. The participant who did not decline is notified that the proposed match did not go ahead. A new round opens for each of them and the scenario resumes at step 6.
- **A4 (no response):** at step 9 or 10 a participant neither accepts nor declines before the proposal expires (OQ-004). The system closes the round as lapsed, notifies both participants that the proposal expired, returns them to the pool and resumes at step 6.
- **A5 (user withdraws):** at any point before step 11 the user withdraws from the event. The system removes them from that event's matching pool and closes any pending round; if a proposal was pending, the other participant is notified that it did not go ahead and is returned to the pool. The use case ends without a match for the user (FR-031).
- **A6 (repeat match):** at step 12 the user has been matched before. The system skips the safety notice — it stays reachable from the profile — and continues at step 13.
- **E1 (incomplete profile):** at step 2 the user's profile does not yet contain the interests the matching relies on. The system asks the user to complete their profile first (FR-002) and the scenario resumes at step 2.
- **E2 (event cancelled):** the organization cancels the event before step 11. The system dissolves the pool and any pending rounds, notifies everyone who had requested a match for that event, and the use case ends without a match (FR-011).
- **E3 (participant banned):** between the proposal and the event one participant is banned by an administrator (FR-027). The system invalidates the proposal or match, hides the banned account's contact details from the other participant, notifies them that their company for this event is no longer available and returns them to the pool; a new round opens and the scenario resumes at step 6.

---

## AI Usage Note

UC-001 was drafted by Claude from US-009, the matching requirements and the scenario specified by Viktoriia Baran. The final result was reviewed and edited without agent's assistance.
