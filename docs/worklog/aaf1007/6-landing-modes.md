# #6 Landing: show all six Game Modes in an even grid

Status: in-review
Branch: feat/6-landing-modes
Updated: 2026-10-06

## Goal
The landing page Game Modes section listed 5 of the 6 Modes (no Arena) and its tiles were uneven. Show all six in an equal-height grid. Spec: issue #6.

## Done so far
- `ModesShowcase` builds tiles from `MODE_UI_LIST` (lib/ui/modes.ts) instead of a hardcoded list; the heading number word comes from the list length ("Six ways…").
- Arena pitch added to `MODE_PITCH`.
- Grid is 1 / 2 / 3 columns (phone / sm / lg); tiles get `h-full`, so every card in a row is the same height.
- Checked signed-out render at 390, 700 and 1100px wide: 1/2/3 columns, equal heights (312/289/287px), no horizontal scroll. Typecheck + eslint clean.

## Next steps
1. User review; on approval open the PR (tick FEATURES.md, set this to done, `Closes #6`).

## Decisions & gotchas
- Under `next dev`, `/` redirects signed-in browsers to /home (DEV_PLAYER_ID or a Clerk cookie). To see the landing, run with `DEV_PLAYER_ID=` and fetch `/` with `credentials: 'omit'`.
- The selected-tile detail panel wasn't click-tested (static render only); it reads `MODE_PITCH[mode]`, which now covers every Mode by type.

## Files touched
- components/landing/Sections.tsx
