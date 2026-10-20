# Test Plan

## Scope

- **Listings:** creating and browsing listings (FR-021, FR-022).
- **Categories:** the public list and the admin endpoints (FR-029).
- **Profile:** creating and editing the user's own profile (FR-002).
- **Interest overlap:** the score of shared interests between two users (FR-017).

## Test Levels

| Level | Where |
|---|---|
| Unit | `tests/unit/` |
| Integration | `tests/e2e/` |
| System | CI, planned |
| Acceptance | `tests/e2e/` |

## Risks

| Risk | Why it matters | Tests |
|---|---|---|
| Dates are counted in UTC, not Kyiv time | Listings vanish or stay a day too long around midnight; ages are off by a day | TC-01, TC-02, TC-08 |
| An inactive category is offered to users | New listings land in a category the admins have retired | TC-05, TC-06 |
| The interest score is wrong | Poor matches once matching runs | TC-09 |
| Listings are slow under load | Browsing is what most sessions do | TC-10 |
| A dependency with a known vulnerability ships | An attack we could have prevented | TC-11 |

## Test Cases

| № | Component/function | Level | Type | Expected result / acceptance criterion | Owner | Requirement | Status |
|---|---|---|---|---|---|---|---|
| TC-01 | `ListingsService.create` | Unit | Negative | A listing dated yesterday is rejected and nothing is stored | Viktoriia Baran | FR-021 | done |
| TC-02 | `POST /listings` | Integration | Negative | A listing with a past date is refused with `422` | Viktoriia Baran | FR-021 | done |
| TC-03 | `GET /listings` | Acceptance | Positive | US-010 AC1: a listing posted by one user is visible to another | Vlad Redchuk | FR-021, FR-022 | planned |
| TC-04 | `GET /listings` | System | Positive | Only active listings dated today or later are returned, in pages of the requested size | TBD | FR-022 | planned |
| TC-05 | `CategoriesService.listActive` | Unit | Negative | Inactive categories are left out of the list | Vlad Redchuk | FR-029 | planned |
| TC-06 | `GET /categories` | Integration | Negative | Inactive categories are left out of the public list | Viktoriia Baran | FR-029 | done |
| TC-07 | `POST /admin/categories` | Integration | Positive | An admin adds a category; it is saved as active and answered with `201` | Viktoriia Baran | FR-029 | done |
| TC-08 | `ageOn` | Unit | Positive | The birthday counts as a full year, and a 29 February birthday counts from 1 March | Viktoriia Baran | FR-002, SAFE-001 | done |
| TC-09 | `interestOverlap` | Unit | Positive | The score is shared interests over all distinct interests; identical lists score 1, disjoint lists 0 | Daryna Halytska | FR-017 | done |
| TC-10 | Listings under load (k6) | System | Positive | 500 concurrent sessions for 10 minutes on `GET /listings`: p95 ≤ 1000 ms, p99 ≤ 2000 ms, max ≤ 5000 ms | Oleg Moshenskiy | FR-022, PERF-001 | planned |
| TC-11 | Dependency audit in CI | System | Negative | `npm audit --audit-level=high` finds zero High and zero Critical advisories | Daryna Halytska | SEC-006 | done |

## Exit Criteria

1. Every row is **done** and passes in CI: the `CI passed` job is green on `main`.

## AI Usage Note

Drafted with Claude Code from the lab requirements, the repository's tests and the requirements documents; reviewed by the team.
