# Reliability Scavenger Hunt

Reliability risks found in the Nearby API (`src/`) and mobile app (`app/`) for Lab 9, with their fault → error → failure chain.

## Findings

| ID | Code | Category | Location | Finding | Severity |
|---|---|---|---|---|---|
| REL-01 | B, E | External dependencies; performance and blocking | `src/infra/prisma/prisma.service.ts` | Database calls have no connection or statement timeout | High |
| REL-02 | E, D | Performance and blocking; silent failures | `app/src/api/client.ts` | App requests have no timeout; on Android they can wait forever | Medium |
| REL-03 | D | Silent failures | `app/src/app/(tabs)/profile.tsx`, `app/src/app/organization/settings.tsx` | Sign-out dispatches a navigation action no navigator handles | Low |


## AI Usage Note

The findings were found by Vlad, checked with Claude Code against the code, then reviewed by the team.
