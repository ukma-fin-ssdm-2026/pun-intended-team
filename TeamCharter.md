# Team Charter

## 1. Basic Information
- **Team name:** Pun Intended
- **Members:**
  - Baran Viktoriya Andriivna (GitHub: @viktoriyabaran, NaUKMA email: v.baran@ukma.edu.ua)
  - Halytska Daryna Yuriivna (GitHub: @DarynaHalytska, NaUKMA email: d.halytska@ukma.edu.ua)
  - Moshenskyi Oleh Mykolaiovych (GitHub: @OLEGkn-coder, NaUKMA email: o.moshenskyi@ukma.edu.ua)
  - Redchuk Vladyslav Serhiiovych (GitHub: @Vlad-Re, NaUKMA email: v.redchuk@ukma.edu.ua)

## 2. Roles and Responsibilities
- **Repo Maintainer:** Viktoriya Baran — manages the GitHub repository structure, branching, and merges.
- **CI Maintainer:** Vladyslav Redchuk — sets up and maintains GitHub Actions workflows.
- **Documentation Lead:** Daryna Halytska — keeps the README, charter, and other documentation clear and up to date.
- **Issue Tracker Lead:** Oleh Moshenskyi — manages GitHub issues, labels, and task assignments.
- **Project Brief Lead:** Daryna Halytska — responsible for Project-Description.md and the mini-spec.

## 3. Communication Plan
- **Primary channel:** Signal
- **Meeting schedule:** online, once a week
- **Response expectations:** reply to messages within 24 hours; if a member is tagged in chat — within 4 hours during working hours.

## 4. Collaboration and Workflow

### Branching Strategy
- GitHub Flow: the `main` branch is always in a working state; direct pushes to it are prohibited.
- All development happens in short-lived branches created from `main`.
- Branch naming format: `feature/<issue-number>-<short-description>`.
- Work is distributed by module/feature where possible, to minimize conflicts between team members.

### Commit Practices
- Commits are atomic — one commit corresponds to one logical change.
- Message format: `(#issue-number) Short description in the imperative mood` — e.g., `(#3) Write initial README`.
- Commit message language: English.

### Code Review
- Merging into `main` is only possible via a pull request.
- Before opening a pull request, merge `main` into the relevant feature branch to avoid conflicts.
- At least 1 approval from another team member is required; for a subtask, approval must come from the person responsible for the parent task.
- The PR author verifies that the code works locally before requesting a review.
- The reviewer responds within 48 hours; if there's no response, the author pings the team's general chat.
- If there's disagreement over review comments, the decision is made through a short discussion in chat/a call, not unilaterally.
- A branch can only be closed once every comment on it has been addressed.

### Task Workflow
- Tasks are tracked via GitHub Issues.
- A team member assigns a task to themselves from the To Do column (respecting the limit on the number of tasks in progress).
- Definition of Done: code merged into `main`, PR closed, functionality manually verified.
- The branch is deleted after the PR is merged.

## 5. Conflict Resolution
1. A direct conversation between the members involved in the disagreement — first try to resolve it without involving the whole team.
2. If unresolved — the issue is raised at the next team meeting for discussion.
3. If no consensus is reached — a majority vote.
4. If the conflict cannot be resolved within the team (including interpersonal disputes that interfere with work) — escalation to the course instructor.

All decisions reached through a vote or escalation are recorded in writing (in the team chat or meeting minutes) to avoid reopening the issue.

## 6. Availability and Workload

| Member | Hours/week | Convenient days/times |
|---|---|---|
| Viktoriya | ~5 hrs (depending on task load) | Monday, Friday, Saturday, Sunday |
| Oleh | ~5 hrs (depending on task load) | All days except Wednesday and Thursday |
| Vladyslav | ~5 hrs (depending on task load) | All days except Thursday |
| Daryna | ~5 hrs (depending on task load) | Monday, Friday, Saturday, Sunday |

If a member feels overloaded, they notify the team as soon as possible (without waiting for the deadline) — tasks are redistributed at the next sync-up.

A persistent inability to complete the stated workload is discussed at a team meeting, and the distribution of roles in the project is adjusted if needed.

## 7. Ethical and Professional Conduct
- All members comply with the institution's academic integrity rules and the ACM Code of Ethics.
- Code and documentation borrowed from external sources (Stack Overflow, tutorials, libraries) must be accompanied by a reference to the source in a comment or in the documentation — passing off someone else's code/text as one's own is prohibited.
- Use of AI tools is recorded in accordance with Section 8 of this charter.
- Members communicate with each other respectfully: constructive criticism of code and decisions is welcome, personal attacks are not.
- Feedback on another member's work is given directly to that person, not discussed in their absence.

## 8. Use of AI
- **Tools:** Claude CLI.
- **Disclosure rules:** AI use is noted in the commit message corresponding to the generated portion of code; it is additionally mentioned in the Loom video for the relevant lab artifact.
- **Verification rule:** generated code goes through review and tests before merging; unverified generated code does not enter the main branch.

## 9. Signatures
- [ ] Viktoriia Baran (GitHub: @viktoriyabaran)
- [ ] Daryna Halytska (GitHub: @DarynaHalytska)
- [ ] Oleh Moshenskyi (GitHub: @OLEGkn-coder)
- [ ] Vladyslav Redchuk (GitHub: @Vlad-Re)