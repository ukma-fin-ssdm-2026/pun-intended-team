# Reliability Scavenger Hunt

Reliability risks found in the Nearby API (`src/`) and mobile app (`app/`) for Lab 9, with their fault → error → failure chain.

## Findings

| ID | Code | Category | Location | Finding | Severity |
|---|---|---|---|---|---|
| REL-01 | B, E | External dependencies; performance and blocking | `src/infra/prisma/prisma.service.ts` | Database calls have no connection or statement timeout | High |
| REL-02 | E, D | Performance and blocking; silent failures | `app/src/api/client.ts` | App requests have no timeout; on Android they can wait forever | Medium |
| REL-03 | D | Silent failures | `app/src/app/(tabs)/profile.tsx`, `app/src/app/organization/settings.tsx` | Sign-out dispatches a navigation action no navigator handles | Low |
| REL-04 | D, B | Silent failures; external dependencies | `src/api/system/controllers/system.controller.ts` | `/health` answers "ok" without checking the database, so a deploy that cannot reach it is not rolled back | Medium |
| REL-05 | C, B | Input validation; external dependencies | `src/api/common/config.ts` | `PORT` and `AUTH_RATE_LIMIT_PER_MINUTE` are read with `Number()` and not checked: an empty value blocks every sign-in or picks a random port | Medium |
| REL-06 | D, B | Silent failures; external dependencies | `deploy/backup-db.sh` | A failed nightly backup skips the day without notice and leaves its `.partial` file on disk | Medium |
| REL-07 | D | Silent failures | `app/src/app/profile-edit.tsx` | When interests fail to load, profile edit hides the "more" button instead of showing an error | Low |


## AI Usage Note

The findings were found by Vlad, checked with Claude Code against the code, then reviewed by the team.
