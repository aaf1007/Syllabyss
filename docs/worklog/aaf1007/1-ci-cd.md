# #1 CI/CD: GitHub Actions CI and gated Render deploy

Status: done
Branch: feat/1-ci-cd
Updated: 2026-10-05

## Goal
CI on PRs and main pushes, DB tests on a throwaway TimescaleDB, and CD to Render with production migrations behind an approval gate. Setup guide: `docs/deploy.md` §7.

## Done so far
- `.github/workflows/ci.yml`: `check` job (typecheck, lint, unit tests, build) and `db-test` job (timescaledb-ha:pg17 service, create toolkit, migrate from scratch, `test:db`). actionlint clean.
- `.github/workflows/deploy.yml`: on CI success on main → plan (pending migrations) → migrate (only if pending; `production` env with reviewers) → deploy via Render API with the tested commitId, poll until live → smoke test.
- `package.json` `typecheck` now runs `next typegen` first (a clean checkout had 50 `RouteContext` errors otherwise).
- Verified locally: a clean checkout with no env builds, and typegen + tsc pass. Unit tests 433/433.

## Next steps
1. User review. Then open a PR to main; the PR's CI run is the first real test of `db-test` (not run locally: no Docker here).
2. User does the one-time Render + GitHub setup in `docs/deploy.md` §7 before merging (Render Auto-Deploy Off by then).
3. At PR time: add the feature to `docs/FEATURES.md`, set this worklog to done.

## Decisions & gotchas
- Issues now live on aaf1007/Syllabyss (this is issue #1 there; the older `1-foundation.md` worklog is the team repo's #1).
- No secrets in CI: `next build` works without any Clerk key.
- Migrations don't create `timescaledb_toolkit` (Tiger Cloud preinstalls it), so the CI job creates it.
- Two environments so routine deploys need no click: `production-db` (main only) for status + Render key, `production` (reviewers) for migrate.
- `deploy.yml` only triggers via workflow_run once it's on the default branch.

- First PR CI runs found: tzdata 2026c (Node 22.23) keeps Vancouver on UTC−7 from March 2026 (tests moved to past DST dates); `seed-courses.mts` read `python-basics.sonar.json` as a Course (now skipped); Daily DB test needs a seeded pool (CI seeds courses + daily). PR #2 checks green after that.

## Files touched
- lib/daily/daily.test.ts, lib/social/days.test.ts, scripts/seed-courses.mts, .github/workflows/ci.yml, .github/workflows/deploy.yml, package.json, docs/deploy.md, CLAUDE.md, this worklog
