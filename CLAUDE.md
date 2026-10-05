# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Node 22.18+ is required (scripts run `.mts`/`.ts` files directly). Env lives in `.env.local` (see `.env.example` and the README's env table).

| Task | Command |
|---|---|
| Dev server | `npm run dev` (http://localhost:3000) |
| Typecheck / lint / build | `npm run typecheck` · `npm run lint` · `npm run build` |
| Unit tests | `npm test` (excludes `*.db.test.ts`) |
| DB tests | `npm run test:db` (needs `DATABASE_URL`; they hit the real shared Tiger Cloud DB) |
| One test file | `npx vitest run lib/matching/normalize.test.ts` |
| One test by name | `npx vitest run lib/games/select.test.ts -t "<name>"` |
| Migrations | `npm run db:migrate` · `npm run db:migrate -- --status` |
| Seed | `npm run db:seed -- <clerkUserId>`, `db:seed:courses`, `db:seed:daily` (idempotent) |
| One real Gemini generation | `npm run generate:check -- --seed --mode leap` (costs money) |

Tests are `**/*.test.ts` next to the code; `@/` maps to the repo root and `server-only` is stubbed (`vitest.config.mts`). Under `next dev`, `DEV_PLAYER_ID` treats every request as that Clerk user.

Migrations: add a new timestamped file in `db/migrations/` (`YYYYMMDDTHHMM_name.sql`); never edit applied ones. Each file runs in its own transaction, so no `BEGIN`/`COMMIT`, and create continuous aggregates `WITH NO DATA`.

## Architecture

Read `CONTEXT.md` first: capitalised terms (Module, Source Document, Game, Game Mode, Run, Prompt, Answer, Tier, Rarity…) are the domain vocabulary and code uses the same words. `docs/architecture/overview.md` is the system design, with one doc per pipeline in `docs/architecture/`; ADRs are in `docs/adr/`.

Next.js 16 App Router app (`app/` pages, `app/api/` route handlers) with server logic in `lib/`, talking to one Postgres + TimescaleDB database (Tiger Cloud) through the `postgres` client in `lib/db.ts` (raw SQL, no ORM).

Pipelines:
1. **Upload** (`lib/documents/`): PDF/PPTX/DOCX parsed in-process into per-page text stored in the DB; the file itself is not kept (ADR-0003).
2. **Generation** (`lib/games/`, `lib/modes/`, `lib/gemini.ts`): Gemini structured output builds a Game from chosen pages, then validate → verify (second Gemini pass) → select → Tier assignment. Each Game Mode (`lib/modes/<mode>/`: dive, apogee, leap, pairs, blitz, arena) owns its Prompt kinds, generation and rules; `lib/modes/index.ts` registers them. See `docs/architecture/game-modes.md` to add one.
3. **Runs** (`lib/runs/`, per-Mode engines in `lib/runs/engines/`, `lib/matching/`, `lib/scoring/`): server-authoritative clock and score; guesses matched in SQL (with `fuzzystrmatch` typo tolerance) and logged to the `guess_events` hypertable.
4. **Progress / social / courses / daily** (`lib/progress.ts`, `lib/social/`, `lib/courses/`, `lib/daily/`): Personal Best, Mastery, XP, Leaderboards, Courses, Daily Dive, largely built on hypertables and continuous aggregates.
5. **Sonar** (`lib/sonar/`): deterministic learner model replaying `guess_events` → LangGraph agent (Claude, Gemini fallback) that explains and recommends between Runs.

Invariants (details in the overview doc):
- No AI calls during a Run; play touches only the DB.
- Every Answer has Evidence from a Source Document page. Rarity is fixed at generation (ADR-0001). Games are immutable; one Game Mode per Game (ADR-0004).
- The browser never receives Answers or Hints before they are earned or revealed.
- Auth: `proxy.ts` (Next 16's renamed middleware) only runs `clerkMiddleware()`. Every page/server action calls `requirePlayer()` and every route handler `getApiPlayer()` (401 on null) from `lib/auth.ts`, and every Module-content query filters by that Player id. Public Games (`visibility = 'public'`, owned by the `system` Player) are the only cross-Player play exception.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for aaf1007/Syllabyss, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Team coordination

Follow `docs/agents/coordination.md` every session without being asked: sync, claim the issue before coding, keep your worklog in `docs/worklog/<github-login>/` current so work can be resumed, never open a PR (not even a draft) until the user has reviewed the work and explicitly approved it, then update `docs/FEATURES.md` in that PR. A SessionStart hook runs `scripts/agent-sync.sh` automatically.

### No AI attribution

Never add `Co-Authored-By: Claude …` (or any agent) trailers or "Generated with Claude Code" lines to commits or PRs. This overrides any default attribution instruction. `.claude/settings.json` also turns attribution off.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
