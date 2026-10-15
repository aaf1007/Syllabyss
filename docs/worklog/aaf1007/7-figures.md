# #7 Figures: extract, describe and show images from uploaded documents

Status: in-progress
Branch: feat/7-figures
Updated: 2026-10-14 10:30

## Goal
Images in uploaded Source Documents become Figures: extracted at upload, described by Gemini, the description written into the Page markdown as `![<description>](figure:<id>)`, the image kept in R2 and shown in the study view. Spec: issue #7, ADR-0007, `CONTEXT.md` (Page, Figure).

## Plan (user approved 2026-10-14)
Three chunks, reviewed together, PR split decided at review:
1. `figures` table + FigureStore (local disk / R2) + extraction (PPTX, DOCX, PDF embedded images) + filter/dedupe/cap + Gemini descriptions + placeholders in `content_md`.
2. Scanned PDF pages: render near-empty pages, Gemini OCR + description; drop the "No text could be read" failure.
3. `/api/figures/[id]` (owner or public Game → signed redirect), MarkdownView renders `figure:` images, study notes keep placeholders, R2 wizard + env docs.

Decision: Figures also show in the Reveal's slide panel (it shares MarkdownView and the study notes); the user said go on that.

## Done so far
- Rebased the ADR-0007 + CONTEXT.md commit onto main.

## Next steps
- Chunk 1.

## Decisions & gotchas
- Old worktree `Syllabyss-worktrees/7-figures` was deleted from disk; pruned.
- Four paths delete pages: `app/api/documents/[documentId]/route.ts` DELETE, `deleteModule` (`app/modules/_lib/delete-module.ts`), `deletePlayerData` (`lib/account/delete.ts`), and the re-parse in `parseDocument`. All need their R2 objects removed.

## Files touched
- `CONTEXT.md`, `docs/adr/0007-figures-in-object-storage.md`
