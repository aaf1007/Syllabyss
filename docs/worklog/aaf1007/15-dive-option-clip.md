# #15 Dive: odd-one-out tiles look cut off at the bottom

Status: done
Branch: fix/15-dive-option-clip
Updated: 2026-10-07

## Goal
Stop the Dive play area clipping the bottom row of the odd-one-out grid.

## Done so far
- Padded the two scroll wrappers in the Dive play area (`-mx-2 px-2 pb-3`) so the tiles' box-shadow ring and drop fit inside.

## Next steps
None.

## Decisions & gotchas
- The clip comes from `overflow-y-auto` on the wrapper, which clips the tiles' `box-shadow`. Apogee renders the same components without a scroll wrapper, so it was unaffected.

## Files touched
- components/modes/dive/DiveRunScreen.tsx
