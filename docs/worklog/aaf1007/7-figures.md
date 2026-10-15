# #7 Figures: extract, describe and show images from uploaded documents

Status: in-review
Branch: feat/7-figures
Updated: 2026-10-15 00:30

## Goal
Images in uploaded Source Documents become Figures: extracted at upload, described by Gemini, the description written into the Page markdown as `![<description>](figure:<id>)`, the image kept in R2 and shown in the study view. Spec: issue #7, ADR-0007, `CONTEXT.md` (Page, Figure), `docs/architecture/upload-pipeline.md` § Figures.

## Plan (user approved 2026-10-14)
Three chunks, reviewed together; PR split decided at review:
1. `figures` table + FigureStore (local disk / R2) + extraction (PPTX, DOCX, PDF embedded images) + filter/dedupe/cap + Gemini descriptions + placeholders in `content_md`.
2. Scanned PDF pages: render near-empty pages, Gemini OCR + description; drop the "No text could be read" failure.
3. `/api/figures/[id]` (owner or public Game → signed redirect), MarkdownView renders `figure:` images, study notes keep placeholders, R2 wizard + env docs.

Decision: Figures also show in the Reveal's slide panel (it shares MarkdownView and the study notes); the user said go on that.

## Done so far
All three chunks, on `feat/7-figures` (commits "Figures: …"):
- Migration `20261014T1100_figures.sql`: `figures` + `figure_orphans` (AFTER DELETE trigger queues objects).
- `lib/figures/`: `store.ts` (local/R2, `missingR2Vars`), `images.ts` (sharp → WebP 1600 px, white background, decoration filter), `select.ts` (logo/dup/cap rules), `pipeline.ts` (`extractWithFigures`), `queries.ts` (`getVisibleFigureKey`), `sweep.ts`.
- Extractors take an `ImageSink` (`lib/documents/extract/markers.ts`); PDF tracks the CTM for image positions and renders scans with `@napi-rs/canvas`.
- `lib/gemini.ts` `generateJson` (multimodal); `lib/gemini/figures.ts` (`describeFigures`, `transcribeScan`); notes keep placeholders (`keepFigures`).
- `/api/figures/[figureId]`, MarkdownView `figure` inline, CSP img-src R2, `instrumentation.ts` refuses to start in production without R2.
- Every delete path calls `after(sweepFigureOrphansLater)`.
- `scripts/wizard-r2.sh`; docs: upload-pipeline, data-model, deploy (§ Figure storage), README, `.env.example`.
- Verified: unit tests, DB tests on a fresh TimescaleDB container (port 55432, migrations applied there only), and end to end with `next dev` + real Gemini (PPTX diagram described, repeated logo dropped, scanned page transcribed exactly, study view shows the image, delete sweeps it). Docker image builds; sharp and canvas load; startup fails without R2 as designed.

## Next steps
- User review. Then: R2 set up on Render (`bash scripts/wizard-r2.sh`) BEFORE merging, or production won't start.
- At PR time: FEATURES.md row (new F-number, Issue #7), worklog `Status: done`, `Closes #7`.

## Decisions & gotchas
- Old worktree `Syllabyss-worktrees/7-figures` was deleted from disk; pruned.
- Deleting images: a DB trigger queues each deleted Figure's object in `figure_orphans`; delete paths sweep after commit. Replaces "delete objects after commit" from the issue: works for every cascade path and never loses an image on rollback.
- "Repeated more than twice" means: the same picture (sha256 of the source bytes) on more than 2 Pages is a logo and is dropped everywhere.
- Decoration filter: longest side < 100 px or shorter side < 32 px (keeps wide equation images).
- Scan = a PDF page with < 25 non-space characters in its text layer. Title-only slides also count; they just get transcribed.
- A failed store write fails the upload (bytes can't be fetched again); a failed description doesn't.
- `npx vitest run <path>` includes `*.db.test.ts` and uses `.env.local`'s DB; use `npm test -- <path>` for unit tests.
- `lib/daily/daily.test.ts` "share text" fails locally whenever `.env.local` sets `NEXT_PUBLIC_SITE_URL` (vitest loads it); unrelated, passes in CI.

## Files touched
- `db/migrations/20261014T1100_figures.sql`, `lib/figures/*`, `lib/documents/extract/*` (+ fixtures and `make-figure-fixtures.mts`), `lib/documents/parse-document.ts`, `lib/documents/parsed-pages.ts`, `lib/gemini.ts`, `lib/gemini/figures.ts`, `lib/gemini/notes.ts`, `app/api/figures/[figureId]/route.ts`, the four delete routes, `app/modules/_lib/markdown.ts`, `app/modules/_components/MarkdownView.tsx`, `lib/security/headers.ts`, `instrumentation.ts`, `next.config.ts`, `package.json`, `scripts/wizard-r2.sh`, docs, `CONTEXT.md`, `docs/adr/0007-figures-in-object-storage.md`
