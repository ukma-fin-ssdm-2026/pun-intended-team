# Team Charter

## 1. Basic Information
- **Team name:** Pun Intended
- **Members:**
  - Baran Viktoriya Andriivna (GitHub: @viktoriyabaran, NaUKMA email: v.baran@ukma.edu.ua)
  - Halytska Daryna Yuriivna (GitHub: @DarynaHalytska, NaUKMA email: d.halytska@ukma.edu.ua)
  - Moshenskyi Oleh Mykolaiovych (GitHub: @OLEGkn-coder, NaUKMA email: o.moshenskyi@ukma.edu.ua)
  - Redchuk Vladyslav Serhiiovych (GitHub: @Vlad-Re, NaUKMA email: v.redchuk@ukma.edu.ua)

## 2. Roles and Responsibilities

- **Viktoriya Baran**
  - Repo Maintainer — manages the GitHub repository structure, branching, and merges.
  - Quality Lead — ensures NFRs are measurable and properly documented.
  - Architecture Lead — coordinates the choice of architecture style and the component diagram.
  - Backend Lead — writes the core API code with annotations.
  - API Design Lead — owns `docs/api/api-design.md` (resource model, status codes, versioning) and checks that endpoints are consistent with it.
  - Documentation Lead (Lab 5) — updates the charter and the summary reports.
  - Testing Lead (Lab 6) — coordinates unit testing and coverage measurement; owns the shared fixtures, mocks, and edge cases in the test suite.
  - Quality Analyst (Lab 7) — summarizes the results of the other team's review.

- **Daryna Halytska**
  - Documentation Lead — keeps the README, charter, and other documentation clear and up to date; organizes Markdown files and handles related commits.
  - Project Brief Lead — responsible for Project-Description.md and the mini-spec.
  - Data & Threat Modeler — builds the data model and leads the STRIDE analysis of the deployment diagram.
  - Documentation Lead (API) — sets up automatic documentation generation and GitHub Pages.
  - Security Analyst — checks how data is handled, runs the security analyzer, documents vulnerabilities, and owns the dependency audit (Dependabot, `npm audit` in CI).
  - Testing Strategist (Lab 6) — writes the testing strategy (`docs/testing/testing-strategy.md`) and plans how tests are integrated into CI.
  - Test Planner (Lab 7) — coordinates writing the test plan (`docs/validation/test-plan.md`) and the structure of its table.

- **Oleh Moshenskyi**
  - Issue Tracker Lead — manages GitHub issues, labels, and task assignments.
  - Requirements Lead — facilitates writing and refining user stories.
  - FR Lead — owns the FR section in `requirements.md` and cross-checks it against the Lab 1 mini-spec and user stories.
  - Requirements-Architecture Mapper — creates the requirements-to-components traceability matrix.
  - Quality Lead (API) — owns `docs/api/quality-attributes.md` (goals with failure conditions) and verifies the validation of every endpoint through Swagger UI.
  - Code Reviewer — reviews the other team's code.
  - Prototype Lead — owns the base code structure, the first working component, and `progress.md`.
  - Debugging Lead (Lab 6) — leads the "break, then debug" challenge and documents the findings in `docs/testing/debugging-log.md`.
  - Documentation Owner (Lab 7) — maintains `docs/validation/test-plan.md` and creates `docs/validation/review-log.md`.

- **Vladyslav Redchuk**
  - CI Maintainer — sets up and maintains GitHub Actions workflows.
  - Traceability Lead — maintains the RTM (Requirements Traceability Matrix).
  - UML Lead — responsible for the correctness of UML diagrams.
  - Integration Lead — integrates all components, the tests and the CI/CD pipeline.
  - Quality Lead (code) — coordinates the code review and sets up static analysis.
  - Review Manager (Lab 7) — passes the test plans between teams and records the feedback.
  - AI Code Reviewer (Lab 7) — leads the review of an AI-generated pull request with the course checklist and records it in `docs/validation/review-log.md`.

Each requirements artifact (user stories, NFRs, RTM) has one person responsible for writing it (the Lead of the corresponding role) and at least one reviewer from among the other members, per the Requirements Review rules below.

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

### Requirements Review
- User stories and use cases are reviewed via pull request before merging into `main`, same as code — at least 1 approval from a team member other than the author, per the Code Review rules in §5.
- Reviewers check each story against the INVEST checklist and confirm the acceptance criteria are testable.
- Non-functional requirements are reviewed in a dedicated weekly sync session (see §3, Communication Plan) rather than only asynchronously: the Quality Lead walks the team through each NFR's fit criterion and verification method to confirm both are measurable before the requirement is committed.

### Task Workflow
- Tasks are tracked via GitHub Issues.
- A team member assigns a task to themselves from the To Do column (respecting the limit on the number of tasks in progress).
- Definition of Done: code merged into `main`, PR closed, functionality manually verified.
- The branch is deleted after the PR is merged.

### Weekly Task Deadlines
To leave time for code review, the team finishes its work a day before the course deadline.

- **Saturday 21:00 — soft deadline:** all work for the week is done and its pull requests are open.
- **Saturday 22:00 — hard deadline:** no new work is started or pushed after this point.
- **Sunday — review fixes only:** only changes requested in review comments are made. Reviewers leave their comments by Sunday 12:00; for weekly tasks this replaces the 48-hour response window in *Code Review*.
- Everything must be merged into `main` before the course deadline (24 hours before the next lab session), when the repository is collected for grading.

### Issue Labels
The team replaced GitHub's default labels with its own set, grouped by area and by type of work. Every issue gets at least one area label; type labels are added as needed.

| Label | Category | Meaning |
|---|---|---|
| `backend` | Area | Work on the NestJS/Prisma API, database, or server-side logic. |
| `frontend` | Area | Work on the Expo/React Native client (iOS, Android, or web). |
| `docs` | Area | Improvements or additions to documentation (charter, requirements, architecture notes, README, etc.). |
| `deploy` | Area | CI/CD pipeline configuration, environment setup, releases. |
| `chore` | Type | Maintenance work with no direct effect on functionality (dependency bumps, repo housekeeping, config). |
| `tests` | Type | Writing or fixing unit/integration/system tests. |
| `refactor` | Type | Restructuring existing code without changing external behavior. |
| `bug` | Type | Something isn't working as intended. |
| `blocked` | Status | The task cannot proceed until a dependency (another issue, a decision, external input) is resolved; the blocking issue is linked in a comment. |
| `feedback` | Status | Feedback from the course instructor; excluded from the team's own tracker scoring. |

Labels are assigned by the Issue Tracker Lead (Oleh Moshenskyi) when an issue is created or triaged, and may be adjusted by any member if the work's scope changes.

## 5. Code Quality and Review Policy

### Coding Standard
- The team follows the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html), with these exceptions:
  - lines are up to 120 characters;
  - file names follow the NestJS convention (`events.controller.ts`);
  - JSDoc is written only where a name does not explain the purpose;
  - zod schemas share the name of the type they define (`Category`).
- TypeScript runs in `strict` mode. ESLint and Prettier check what they can; reviewers check the rest.
- Code follows the layers and mechanisms in [`docs/architecture/mechanisms/`](docs/architecture/mechanisms/).

### Required Tools
- **Prettier** — formats the code (`npm run format`).
- **ESLint** — checks the code against the `typescript-eslint` and `eslint-plugin-security` recommended rules (`npm run lint`).
- **`commit-msg` hook** — checks the commit message format (`.githooks/commit-msg`).
- **pre-commit** — runs gitleaks, Prettier and ESLint on the staged files before every commit (`.pre-commit-config.yaml`).
- **npm audit and Dependabot** — check the dependencies for known vulnerabilities and propose updates.
- **GitHub Actions** — runs the checks and the end-to-end tests on every pull request.

### Code Review
- Merging into `main` is only possible via a pull request.
- Before opening a pull request, merge `main` into the relevant feature branch to avoid conflicts.
- At least 1 approval from another team member is required; for a subtask, approval must come from the person responsible for the parent task.
- The PR author verifies that the code works locally before requesting a review.
- The reviewer responds within 48 hours; if there's no response, the author pings the team's general chat.
- If there's disagreement over review comments, the decision is made through a short discussion in chat/a call, not unilaterally.
- A branch can only be closed once every comment on it has been addressed.

### Definition of Done
In addition to the Definition of Done in §4, a pull request is merged only when:
- the `CI passed` check is green: formatting, linting, type checking, end-to-end tests, the API spec check and the dependency audit;
- new or changed behaviour is covered by end-to-end tests;
- the documentation affected by the change is updated (API design, generated spec, README, architecture docs).

## 6. Conflict Resolution
1. A direct conversation between the members involved in the disagreement — first try to resolve it without involving the whole team.
2. If unresolved — the issue is raised at the next team meeting for discussion.
3. If no consensus is reached — a majority vote.
4. If the conflict cannot be resolved within the team (including interpersonal disputes that interfere with work) — escalation to the course instructor.

All decisions reached through a vote or escalation are recorded in writing (in the team chat or meeting minutes) to avoid reopening the issue.

## 7. Availability and Workload

| Member | Hours/week | Convenient days/times |
|---|---|---|
| Viktoriya | ~5 hrs (depending on task load) | Monday, Friday, Saturday, Sunday |
| Oleh | ~5 hrs (depending on task load) | All days except Wednesday and Thursday |
| Vladyslav | ~5 hrs (depending on task load) | All days except Thursday |
| Daryna | ~5 hrs (depending on task load) | Monday, Friday, Saturday, Sunday |

If a member feels overloaded, they notify the team as soon as possible (without waiting for the deadline) — tasks are redistributed at the next sync-up.

A persistent inability to complete the stated workload is discussed at a team meeting, and the distribution of roles in the project is adjusted if needed.

## 8. Ethical and Professional Conduct
- All members comply with the institution's academic integrity rules and the ACM Code of Ethics.
- Code and documentation borrowed from external sources (Stack Overflow, tutorials, libraries) must be accompanied by a reference to the source in a comment or in the documentation — passing off someone else's code/text as one's own is prohibited.
- Use of AI tools is recorded in accordance with Section 9 of this charter.
- Members communicate with each other respectfully: constructive criticism of code and decisions is welcome, personal attacks are not.
- Feedback on another member's work is given directly to that person, not discussed in their absence.

## 9. Use of AI
- **Tools:** Claude CLI.
- **Disclosure rules:**
  1. AI use is noted in the commit message corresponding to the generated portion of code or text.
  2. In addition to the commit message, every artifact containing AI-generated content includes a short **"AI Usage" note directly in the file** (e.g., as a comment block at the top of a code file, or a dedicated subsection in a Markdown document), stating: what was generated by AI, and how it was verified (reviewed, tested, rewritten, etc.).
  3. AI use is additionally mentioned in the Loom video for the relevant lab artifact.
- **Verification rule:** generated code goes through review and tests before merging; unverified generated code does not enter the main branch.

## 10. Artifact Management
- All requirements documentation (user stories, use cases, NFRs, RTM) lives in `docs/requirements/` in the team repository.
- `README.md` is kept up to date with working links to every document in `docs/requirements/` and to the other `docs/` subdirectories listed in the syllabus (architecture, api, code-quality, testing, etc.).
- Keeping `README.md` links current is the responsibility of the Documentation Lead (Daryna Halytska), checked as part of every PR that adds or moves a file under `docs/`.

## 11. Individual Accountability

### Individual Accountability for Requirements Artifacts
- Each team member's Loom video for the requirements-stage lab artifacts must show their own contribution specifically: the user stories they wrote, the NFRs they specified, or the RTM rows they filled in — not a walkthrough of the whole document.
- The team cross-checks evidence of individual contribution against the commit history before each weekly lab deadline, and again at the midterm evaluation and before the final project defense, in line with the commit-history verification described in the course submission policy.

## 12. Signatures
- [x] Viktoriya Baran (GitHub: @viktoriyabaran)
- [x] Daryna Halytska (GitHub: @DarynaHalytska)
- [x] Oleh Moshenskyi (GitHub: @OLEGkn-coder)
- [x] Vladyslav Redchuk (GitHub: @Vlad-Re)

## AI Usage Note
This charter, and its subsequent edits, were written with the participation of Claude. All added/changed points (the §4 Issue Labels table, the §4 Requirements Review subsection, the §4 Weekly Task Deadlines subsection, the §9 Use of AI disclosure rules, §10 Artifact Management, §11 Individual Accountability for Requirements Artifacts, the Lab 4 role descriptions in §2, the Lab 5 role descriptions in §2, and the Lab 6 role descriptions in §2) were AI-generated wording, reviewed and edited by Daryna Halytska. The §5 Coding Standard, Required Tools and Definition of Done were drafted with Claude Code and reviewed by Viktoriya Baran.
