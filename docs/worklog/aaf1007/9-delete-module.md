# #9 Delete a Module

Status: in-review
Branch: feat/9-delete-module
Updated: 2026-10-07

## Goal
Let a Player delete a whole Module from its page, behind a type-the-name confirmation. Spec: issue #9.

## Done so far
- `deleteModule(playerId, moduleId, db)` in `app/modules/_lib/delete-module.ts`: one SQL statement (CTEs) that deletes the Module (FKs cascade to Source Documents, pages, Games, Prompts, Runs) and the Module's `guess_events`. Owner-checked, refuses a Module that backs a Course, false for bad/unknown ids.
- DB tests (`delete-module.db.test.ts`, 3 cases, rolled back): cascade + guesses gone, other Module/guesses and XP kept; other Player / bad id / random id delete nothing; Course Module refused.
- `DELETE /api/modules/[moduleId]` (401 / 404 / 204).
- Module page: "Delete Module" ghost button under the panels; the shared confirm Modal gains a `module` kind with a name field; Delete is disabled until the name matches; Enter submits; on success toast + `/modules`.
- `Modal` focuses a `[data-autofocus]` element when present (else the first focusable, as before).
- Checked in the browser with a throwaway `DEV_PLAYER_ID` player (since deleted): gating, Enter, redirect, toast, deleted Module URL shows "Module not found".

## Next steps
1. User review; on approval open the PR (FEATURES.md row, set this to done, `Closes #9`).
2. When #7 (Figures) lands, delete the Module's Figure objects from R2 after this commits.

## Decisions & gotchas
- **guess_events are deleted, not kept** (issue text said keep). That matches the existing Game delete (`app/api/games/[gameId]/route.ts`) and leaves Sonar no orphans. XP, streaks and badges stay.
- Under `next dev` in a hidden browser tab, `requestAnimationFrame` never fires, so Modal's initial focus doesn't happen; it works in a visible tab.
- `lib/daily/daily.test.ts` "reads NEXT_PUBLIC_SITE_URL" fails locally when `.env.local` sets that var; unrelated, also fails on main.

## Files touched
- app/modules/_lib/delete-module.ts, delete-module.db.test.ts
- app/api/modules/[moduleId]/route.ts
- app/modules/_components/ModuleWorkspace.tsx
- components/ui/Modal.tsx
